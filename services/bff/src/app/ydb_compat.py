"""Compatibility for the pinned YDB Django backend, exercised against local YDB.

The same driver defects affect the ID service. Keep writes in the active data
transaction, preserve nullable/FK types, and restore Django datetime semantics.
"""

import json

import ydb


def _patch_ydb_jsonfield_adapter() -> None:
    try:
        from ydb_backend.backend import operations as ydb_operations
    except ImportError:
        return

    if getattr(ydb_operations.DatabaseOperations, "_updspace_bff_json_patch", False):
        return

    def _adapt_json_value(self, value, encoder):
        if value is None:
            return None
        return json.dumps(value, cls=encoder, separators=(",", ":"))

    ydb_operations.DatabaseOperations.adapt_json_value = _adapt_json_value
    ydb_operations.DatabaseOperations._updspace_bff_json_patch = True


def _patch_ydb_query_parameters() -> None:
    # django-ydb-backend 0.0.1b1 drops parameters without a model column.
    # Django's exists() starts with SELECT %s (the literal 1), so subsequent
    # parameters shift and the compiler raises IndexError before querying YDB.
    from ydb_backend.models.sql import compiler

    if getattr(compiler, "_updspace_bff_parameters_patch", False):
        return

    from django.db.models.expressions import Ref
    from django.db.models.sql.compiler import PositionRef

    original_compile = compiler.SQLCompiler.compile

    def _compile(self, node):
        # Django orders projected fields by their SELECT position (ORDER BY 3).
        # YDB treats that position as a constant, so use the selected alias or
        # the original column/expression instead.
        if isinstance(node, PositionRef):
            node = Ref(node.refs, node.source) if node.refs else node.source
        return original_compile(self, node)

    compiler.SQLCompiler.compile = _compile

    def _parameters(placeholders, columns, field_types, params):
        result = {}
        for index, (placeholder, value) in enumerate(zip(placeholders, params)):
            column = columns[index] if index < len(columns) else None
            field_type = field_types.get(column)
            if field_type is None:
                # The SDK infers literal/annotation parameter types. Keep their
                # position rather than treating them as a neighbouring column.
                result[placeholder] = value
                continue
            parameter_type = compiler._ydb_types[field_type]
            if value is None:
                parameter_type = ydb.OptionalType(parameter_type)
            elif field_type == "DateTimeField":
                value = int(value.timestamp())
            elif field_type in {"FileField", "FilePathField"} and isinstance(
                value, str
            ):
                value = value.encode()
            result[placeholder] = (value, parameter_type)
        return result

    compiler._generate_params_for_update = _parameters

    def _field_type(field):
        while getattr(field, "target_field", None) is not None:
            field = field.target_field
        return field.get_internal_type()

    def _insert_data(fields, rows):
        def prepare(field, value):
            if value is None:
                return None
            kind = _field_type(field)
            if kind == "DateTimeField":
                return int(value.timestamp())
            if kind in {"FileField", "FilePathField"} and isinstance(value, str):
                return value.encode()
            return value

        return [
            {field.column: prepare(field, value) for field, value in zip(fields, row)}
            for row in rows
        ]

    def _insert_type(fields):
        struct = ydb.StructType()
        for field in fields:
            field_type = compiler._ydb_types[_field_type(field)]
            if field.null:
                field_type = ydb.OptionalType(field_type)
            struct.add_member(field.column, field_type)
        return ydb.ListType(struct)

    def _insert_sql(self):
        opts = self.query.get_meta()
        fields = self.query.fields or [opts.pk]
        qn = self.connection.ops.quote_name
        # Parameter types are supplied to the SDK with $in_; duplicating a
        # non-nullable DECLARE breaks nullable model fields such as last_login.
        names = ", ".join(qn(field.column) for field in fields)
        return [
            f"{self._get_statement()} {qn(opts.db_table)} ({names})",
            f"SELECT {names} FROM AS_TABLE($in_);",
        ]

    compiler._get_data = _insert_data
    compiler._get_data_type = _insert_type
    compiler.BaseSQLWriteCompiler._prepare_sql_statement = _insert_sql

    def _execute_insert(self, returning_fields=None):
        rows = []
        with self.connection.cursor() as cursor:
            for sql, params in self.as_sql():
                if returning_fields:
                    names = ", ".join(
                        self.connection.ops.quote_name(field.column)
                        for field in returning_fields
                    )
                    sql = sql.rstrip(";") + f" RETURNING {names};"
                # Use the active data transaction, including for get_or_create.
                cursor.execute(sql, params)
                if returning_fields:
                    rows.extend(cursor.fetchall())
        if returning_fields:
            cols = [
                field.get_col(self.query.get_meta().db_table)
                for field in returning_fields
            ]
            converters = self.get_converters(cols)
            if converters:
                rows = list(self.apply_converters(rows, converters))
        return rows

    # ORDER BY id DESC in the upstream driver can return another request's ID.
    compiler.BaseSQLWriteCompiler.execute_sql = _execute_insert

    def _update_sql(self):
        from django.db.models.sql.compiler import SQLUpdateCompiler

        sql, params = SQLUpdateCompiler.as_sql(self)
        if not sql:
            return sql, params
        # The upstream mapping uses field.name, so user_id is untyped and the
        # SDK infers Int64 even when the referenced user PK is an Int32.
        columns = compiler._extract_column_names(sql)
        sql, placeholders = compiler._replace_placeholders(sql)
        field_types = {
            field.column: _field_type(field)
            for field in self.query.model._meta.concrete_fields
        }
        return sql, _parameters(placeholders, columns, field_types, params)

    compiler.SQLUpdateCompiler.as_sql = _update_sql

    def _execute_update(self, result_type=None):
        sql, params = self.as_sql()
        if not sql:
            return 0
        pk = self.connection.ops.quote_name(self.query.get_meta().pk.column)
        with self.connection.cursor() as cursor:
            cursor.execute(sql.rstrip(";") + f" RETURNING {pk};", params)
            return len(cursor.fetchall())

    compiler.SQLUpdateCompiler.execute_sql = _execute_update

    from datetime import timezone as datetime_timezone

    from django.conf import settings
    from django.utils import timezone
    from ydb_backend.backend.base import DatabaseWrapper
    from ydb_backend.backend.operations import DatabaseOperations
    from ydb_dbapi import IsolationLevel

    original_converters = DatabaseOperations.get_db_converters

    def _datetime_value(value, expression, connection):
        if value is not None and settings.USE_TZ and timezone.is_naive(value):
            return timezone.make_aware(value, datetime_timezone.utc)
        return value

    def _file_value(value, expression, connection):
        return value.decode() if isinstance(value, bytes) else value

    def _converters(self, expression):
        result = original_converters(self, expression)
        kind = _field_type(expression.output_field)
        if kind == "DateTimeField":
            result.append(_datetime_value)
        elif kind in {"FileField", "FilePathField"}:
            result.append(_file_value)
        return result

    DatabaseOperations.get_db_converters = _converters

    def _set_autocommit(self, autocommit):
        self.connection.set_isolation_level(
            IsolationLevel.AUTOCOMMIT if autocommit else IsolationLevel.SERIALIZABLE
        )
        if not autocommit:
            self.connection.begin()

    DatabaseWrapper._set_autocommit = _set_autocommit
    compiler._updspace_bff_parameters_patch = True


def install_ydb_compatibility() -> None:
    _patch_ydb_jsonfield_adapter()
    _patch_ydb_query_parameters()
