# An alternative runtime for the same Portal worker when container quota is full.
variable "portal_outbox_function_zip" {
  description = "Path to the ZIP built by scripts/ci/package-portal-outbox.py; null uses the task-container configuration."
  type        = string
  default     = null
}

resource "yandex_function" "portal_outbox" {
  count = var.portal_outbox_function_zip == null ? 0 : 1

  name               = "${local.name_prefix}-portal-outbox"
  description        = "Portal tenant provisioning retry worker"
  user_hash          = filesha256(var.portal_outbox_function_zip)
  runtime            = "python312"
  entrypoint         = "outbox_function.handler"
  memory             = 512
  execution_timeout  = "300"
  concurrency        = 1
  service_account_id = yandex_iam_service_account.runtime.id
  environment        = merge(local.portal_env, { DJANGO_SETTINGS_MODULE = "app.settings" })

  content {
    zip_filename = var.portal_outbox_function_zip
  }

  dynamic "secrets" {
    for_each = toset(["DJANGO_SECRET_KEY", "BFF_INTERNAL_HMAC_SECRET"])
    content {
      id                   = yandex_lockbox_secret.runtime.id
      version_id           = yandex_lockbox_secret_version.runtime.id
      key                  = secrets.value
      environment_variable = secrets.value
    }
  }

  log_options {
    log_group_id = yandex_logging_group.portal.id
    min_level    = "INFO"
  }
}

resource "yandex_function_iam_binding" "portal_outbox_invoker" {
  count = var.portal_outbox_function_zip == null ? 0 : 1

  function_id = yandex_function.portal_outbox[0].id
  role        = "serverless.functions.invoker"
  members     = ["serviceAccount:${yandex_iam_service_account.trigger.id}"]
}

resource "yandex_function_trigger" "portal_outbox_sweep" {
  count = var.portal_outbox_function_zip == null ? 0 : 1

  name = "${local.name_prefix}-portal-outbox-sweep"
  function {
    id                 = yandex_function.portal_outbox[0].id
    service_account_id = yandex_iam_service_account.trigger.id
    retry_attempts     = 1
    retry_interval     = 30
  }
  timer {
    cron_expression = var.outbox_sweep_cron
  }
  depends_on = [yandex_function_iam_binding.portal_outbox_invoker]
}
