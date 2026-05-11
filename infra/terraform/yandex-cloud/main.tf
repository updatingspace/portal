resource "yandex_vpc_network" "portal" {
  name = "${local.name_prefix}-network"
}

resource "yandex_vpc_subnet" "serverless" {
  name           = "${local.name_prefix}-subnet"
  zone           = var.default_zone
  network_id     = yandex_vpc_network.portal.id
  v4_cidr_blocks = [var.serverless_subnet_cidr]
}

resource "yandex_logging_group" "portal" {
  name             = "${local.name_prefix}-logs"
  retention_period = var.log_retention_period
}

resource "yandex_iam_service_account" "runtime" {
  name        = "${local.name_prefix}-runtime"
  description = "Runtime identity for UpdSpace Portal serverless containers"
}

resource "yandex_iam_service_account" "gateway" {
  name        = "${local.name_prefix}-gateway"
  description = "Identity for API Gateway integrations"
}

resource "yandex_iam_service_account" "trigger" {
  name        = "${local.name_prefix}-trigger"
  description = "Identity for YMQ and timer triggers"
}

resource "yandex_iam_service_account" "automation" {
  name        = "${local.name_prefix}-automation"
  description = "Static-key identity for Object Storage and YMQ"
}

resource "yandex_iam_service_account" "ci" {
  name        = "${local.name_prefix}-ci"
  description = "GitHub Actions deploy identity"
}

resource "yandex_resourcemanager_folder_iam_member" "service_accounts_editor" {
  for_each = {
    runtime    = yandex_iam_service_account.runtime.id
    gateway    = yandex_iam_service_account.gateway.id
    trigger    = yandex_iam_service_account.trigger.id
    automation = yandex_iam_service_account.automation.id
  }

  folder_id = var.folder_id
  role      = "editor"
  member    = "serviceAccount:${each.value}"
}

resource "yandex_lockbox_secret" "runtime" {
  name        = "${local.name_prefix}-runtime"
  description = "Shared runtime secrets for Portal containers"
}

resource "yandex_lockbox_secret_version" "runtime" {
  secret_id = yandex_lockbox_secret.runtime.id

  dynamic "entries" {
    for_each = local.runtime_secret_entries
    content {
      key        = entries.key
      text_value = entries.value
    }
  }
}

resource "yandex_lockbox_secret_iam_member" "runtime_payload_viewer" {
  secret_id = yandex_lockbox_secret.runtime.id
  role      = "lockbox.payloadViewer"
  member    = "serviceAccount:${yandex_iam_service_account.runtime.id}"
}

resource "yandex_iam_service_account_static_access_key" "automation" {
  service_account_id = yandex_iam_service_account.automation.id
  description        = "Static access key for Object Storage and YMQ automation"
}

resource "yandex_container_registry" "portal" {
  name = "${local.name_prefix}-registry"
}

resource "yandex_storage_bucket" "frontend" {
  access_key    = yandex_iam_service_account_static_access_key.automation.access_key
  secret_key    = yandex_iam_service_account_static_access_key.automation.secret_key
  bucket        = local.frontend_bucket_name
  force_destroy = var.object_storage_force_destroy
}

resource "yandex_storage_bucket" "media" {
  access_key    = yandex_iam_service_account_static_access_key.automation.access_key
  secret_key    = yandex_iam_service_account_static_access_key.automation.secret_key
  bucket        = local.media_bucket_name
  force_destroy = var.object_storage_force_destroy
}

resource "yandex_ydb_database_serverless" "portal" {
  name        = var.ydb_database_name
  location_id = var.region
}

resource "yandex_serverless_container" "access" {
  name               = "${local.name_prefix}-access"
  description        = "Access service"
  memory             = local.service_memory_mb.access
  cores              = local.service_cores.access
  core_fraction      = 100
  concurrency        = local.service_concurrency.access
  execution_timeout  = "60s"
  service_account_id = yandex_iam_service_account.runtime.id

  runtime {
    type = "http"
  }

  connectivity {
    network_id = yandex_vpc_network.portal.id
  }

  metadata_options {
    gce_http_endpoint = 1
  }

  image {
    url         = "cr.yandex/${yandex_container_registry.portal.id}/updatingspace-portal-access:${local.image_tags.access}"
    environment = local.access_env
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "DJANGO_SECRET_KEY"
    environment_variable = "DJANGO_SECRET_KEY"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "BFF_INTERNAL_HMAC_SECRET"
    environment_variable = "BFF_INTERNAL_HMAC_SECRET"
  }

  log_options {
    log_group_id = yandex_logging_group.portal.id
    min_level    = "INFO"
  }
}

resource "yandex_serverless_container" "portal" {
  name               = "${local.name_prefix}-portal"
  description        = "Portal service"
  memory             = local.service_memory_mb.portal
  cores              = local.service_cores.portal
  core_fraction      = 100
  concurrency        = local.service_concurrency.portal
  execution_timeout  = "60s"
  service_account_id = yandex_iam_service_account.runtime.id

  runtime {
    type = "http"
  }

  connectivity {
    network_id = yandex_vpc_network.portal.id
  }

  metadata_options {
    gce_http_endpoint = 1
  }

  image {
    url         = "cr.yandex/${yandex_container_registry.portal.id}/updatingspace-portal-portal:${local.image_tags.portal}"
    environment = local.portal_env
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "DJANGO_SECRET_KEY"
    environment_variable = "DJANGO_SECRET_KEY"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "BFF_INTERNAL_HMAC_SECRET"
    environment_variable = "BFF_INTERNAL_HMAC_SECRET"
  }

  log_options {
    log_group_id = yandex_logging_group.portal.id
    min_level    = "INFO"
  }
}

resource "yandex_serverless_container" "featureflags" {
  name               = "${local.name_prefix}-featureflags"
  description        = "Feature flags service"
  memory             = local.service_memory_mb.featureflags
  cores              = local.service_cores.featureflags
  core_fraction      = 100
  concurrency        = local.service_concurrency.featureflags
  execution_timeout  = "60s"
  service_account_id = yandex_iam_service_account.runtime.id

  runtime {
    type = "http"
  }

  connectivity {
    network_id = yandex_vpc_network.portal.id
  }

  metadata_options {
    gce_http_endpoint = 1
  }

  image {
    url         = "cr.yandex/${yandex_container_registry.portal.id}/updatingspace-portal-featureflags:${local.image_tags.featureflags}"
    environment = local.featureflags_env
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "DJANGO_SECRET_KEY"
    environment_variable = "DJANGO_SECRET_KEY"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "BFF_INTERNAL_HMAC_SECRET"
    environment_variable = "BFF_INTERNAL_HMAC_SECRET"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "S3_ACCESS_KEY_ID"
    environment_variable = "S3_ACCESS_KEY_ID"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "S3_SECRET_ACCESS_KEY"
    environment_variable = "S3_SECRET_ACCESS_KEY"
  }

  log_options {
    log_group_id = yandex_logging_group.portal.id
    min_level    = "INFO"
  }
}

resource "yandex_serverless_container" "activity" {
  name               = "${local.name_prefix}-activity"
  description        = "Activity service"
  memory             = local.service_memory_mb.activity
  cores              = local.service_cores.activity
  core_fraction      = 100
  concurrency        = local.service_concurrency.activity
  execution_timeout  = "60s"
  service_account_id = yandex_iam_service_account.runtime.id

  runtime {
    type = "http"
  }

  connectivity {
    network_id = yandex_vpc_network.portal.id
  }

  metadata_options {
    gce_http_endpoint = 1
  }

  image {
    url         = "cr.yandex/${yandex_container_registry.portal.id}/updatingspace-portal-activity:${local.image_tags.activity}"
    environment = local.activity_env
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "DJANGO_SECRET_KEY"
    environment_variable = "DJANGO_SECRET_KEY"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "BFF_INTERNAL_HMAC_SECRET"
    environment_variable = "BFF_INTERNAL_HMAC_SECRET"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "ACTIVITY_DATA_ENCRYPTION_KEY"
    environment_variable = "ACTIVITY_DATA_ENCRYPTION_KEY"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "S3_ACCESS_KEY_ID"
    environment_variable = "S3_ACCESS_KEY_ID"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "S3_SECRET_ACCESS_KEY"
    environment_variable = "S3_SECRET_ACCESS_KEY"
  }

  log_options {
    log_group_id = yandex_logging_group.portal.id
    min_level    = "INFO"
  }
}

resource "yandex_serverless_container" "events" {
  name               = "${local.name_prefix}-events"
  description        = "Events service"
  memory             = local.service_memory_mb.events
  cores              = local.service_cores.events
  core_fraction      = 100
  concurrency        = local.service_concurrency.events
  execution_timeout  = "60s"
  service_account_id = yandex_iam_service_account.runtime.id

  runtime {
    type = "http"
  }

  connectivity {
    network_id = yandex_vpc_network.portal.id
  }

  metadata_options {
    gce_http_endpoint = 1
  }

  image {
    url         = "cr.yandex/${yandex_container_registry.portal.id}/updatingspace-portal-events:${local.image_tags.events}"
    environment = local.events_env
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "DJANGO_SECRET_KEY"
    environment_variable = "DJANGO_SECRET_KEY"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "BFF_INTERNAL_HMAC_SECRET"
    environment_variable = "BFF_INTERNAL_HMAC_SECRET"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "S3_ACCESS_KEY_ID"
    environment_variable = "S3_ACCESS_KEY_ID"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "S3_SECRET_ACCESS_KEY"
    environment_variable = "S3_SECRET_ACCESS_KEY"
  }

  log_options {
    log_group_id = yandex_logging_group.portal.id
    min_level    = "INFO"
  }
}

resource "yandex_serverless_container" "gamification" {
  name               = "${local.name_prefix}-gamification"
  description        = "Gamification service"
  memory             = local.service_memory_mb.gamification
  cores              = local.service_cores.gamification
  core_fraction      = 100
  concurrency        = local.service_concurrency.gamification
  execution_timeout  = "60s"
  service_account_id = yandex_iam_service_account.runtime.id

  runtime {
    type = "http"
  }

  connectivity {
    network_id = yandex_vpc_network.portal.id
  }

  metadata_options {
    gce_http_endpoint = 1
  }

  image {
    url         = "cr.yandex/${yandex_container_registry.portal.id}/updatingspace-portal-gamification:${local.image_tags.gamification}"
    environment = local.gamification_env
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "DJANGO_SECRET_KEY"
    environment_variable = "DJANGO_SECRET_KEY"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "BFF_INTERNAL_HMAC_SECRET"
    environment_variable = "BFF_INTERNAL_HMAC_SECRET"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "S3_ACCESS_KEY_ID"
    environment_variable = "S3_ACCESS_KEY_ID"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "S3_SECRET_ACCESS_KEY"
    environment_variable = "S3_SECRET_ACCESS_KEY"
  }

  log_options {
    log_group_id = yandex_logging_group.portal.id
    min_level    = "INFO"
  }
}

resource "yandex_serverless_container" "voting" {
  name               = "${local.name_prefix}-voting"
  description        = "Voting service"
  memory             = local.service_memory_mb.voting
  cores              = local.service_cores.voting
  core_fraction      = 100
  concurrency        = local.service_concurrency.voting
  execution_timeout  = "60s"
  service_account_id = yandex_iam_service_account.runtime.id

  runtime {
    type = "http"
  }

  connectivity {
    network_id = yandex_vpc_network.portal.id
  }

  metadata_options {
    gce_http_endpoint = 1
  }

  image {
    url         = "cr.yandex/${yandex_container_registry.portal.id}/updatingspace-portal-voting:${local.image_tags.voting}"
    environment = local.voting_env
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "DJANGO_SECRET_KEY"
    environment_variable = "DJANGO_SECRET_KEY"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "BFF_INTERNAL_HMAC_SECRET"
    environment_variable = "BFF_INTERNAL_HMAC_SECRET"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "S3_ACCESS_KEY_ID"
    environment_variable = "S3_ACCESS_KEY_ID"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "S3_SECRET_ACCESS_KEY"
    environment_variable = "S3_SECRET_ACCESS_KEY"
  }

  log_options {
    log_group_id = yandex_logging_group.portal.id
    min_level    = "INFO"
  }
}

resource "yandex_serverless_container" "bff" {
  name               = "${local.name_prefix}-bff"
  description        = "Portal BFF"
  memory             = local.service_memory_mb.bff
  cores              = local.service_cores.bff
  core_fraction      = 100
  concurrency        = local.service_concurrency.bff
  execution_timeout  = "60s"
  service_account_id = yandex_iam_service_account.runtime.id

  runtime {
    type = "http"
  }

  connectivity {
    network_id = yandex_vpc_network.portal.id
  }

  metadata_options {
    gce_http_endpoint = 1
  }

  image {
    url         = "cr.yandex/${yandex_container_registry.portal.id}/updatingspace-portal-bff:${local.image_tags.bff}"
    environment = local.bff_env
  }

  dynamic "provision_policy" {
    for_each = lookup(var.min_ready_instances, "bff", 0) > 0 ? [1] : []
    content {
      min_instances = lookup(var.min_ready_instances, "bff", 0)
    }
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "DJANGO_SECRET_KEY"
    environment_variable = "DJANGO_SECRET_KEY"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "BFF_INTERNAL_HMAC_SECRET"
    environment_variable = "BFF_INTERNAL_HMAC_SECRET"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "BFF_UPDSPACEID_CALLBACK_SECRET"
    environment_variable = "BFF_UPDSPACEID_CALLBACK_SECRET"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "BFF_OIDC_CLIENT_SECRET"
    environment_variable = "BFF_OIDC_CLIENT_SECRET"
  }

  log_options {
    log_group_id = yandex_logging_group.portal.id
    min_level    = "INFO"
  }
}

resource "yandex_serverless_container" "outbox_task" {
  for_each = local.outbox_services

  name               = "${local.name_prefix}-${each.key}-outbox"
  description        = "Outbox worker for ${each.key}"
  memory             = var.task_memory_mb
  cores              = 1
  core_fraction      = 100
  concurrency        = 1
  execution_timeout  = var.task_execution_timeout
  service_account_id = yandex_iam_service_account.runtime.id

  runtime {
    type = "task"
  }

  connectivity {
    network_id = yandex_vpc_network.portal.id
  }

  metadata_options {
    gce_http_endpoint = 1
  }

  image {
    url     = "cr.yandex/${yandex_container_registry.portal.id}/updatingspace-portal-${each.key}:${local.image_tags[each.key]}"
    command = ["/app/bin/serverless-task.sh"]
    args    = ["outbox_process"]
    environment = lookup({
      activity     = local.activity_env
      events       = local.events_env
      featureflags = local.featureflags_env
      gamification = local.gamification_env
      voting       = local.voting_env
    }, each.key)
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "DJANGO_SECRET_KEY"
    environment_variable = "DJANGO_SECRET_KEY"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "BFF_INTERNAL_HMAC_SECRET"
    environment_variable = "BFF_INTERNAL_HMAC_SECRET"
  }

  dynamic "secrets" {
    for_each = each.key == "activity" ? [1] : []
    content {
      id                   = yandex_lockbox_secret.runtime.id
      version_id           = yandex_lockbox_secret_version.runtime.id
      key                  = "ACTIVITY_DATA_ENCRYPTION_KEY"
      environment_variable = "ACTIVITY_DATA_ENCRYPTION_KEY"
    }
  }

  dynamic "secrets" {
    for_each = each.key == "activity" ? [1] : []
    content {
      id                   = yandex_lockbox_secret.runtime.id
      version_id           = yandex_lockbox_secret_version.runtime.id
      key                  = "S3_ACCESS_KEY_ID"
      environment_variable = "S3_ACCESS_KEY_ID"
    }
  }

  dynamic "secrets" {
    for_each = each.key == "activity" ? [1] : []
    content {
      id                   = yandex_lockbox_secret.runtime.id
      version_id           = yandex_lockbox_secret_version.runtime.id
      key                  = "S3_SECRET_ACCESS_KEY"
      environment_variable = "S3_SECRET_ACCESS_KEY"
    }
  }

  log_options {
    log_group_id = yandex_logging_group.portal.id
    min_level    = "INFO"
  }
}

resource "yandex_serverless_container" "retention_task" {
  for_each = local.retention_services

  name               = "${local.name_prefix}-${each.key}-retention"
  description        = "Retention task for ${each.key}"
  memory             = var.task_memory_mb
  cores              = 1
  core_fraction      = 100
  concurrency        = 1
  execution_timeout  = var.task_execution_timeout
  service_account_id = yandex_iam_service_account.runtime.id

  runtime {
    type = "task"
  }

  connectivity {
    network_id = yandex_vpc_network.portal.id
  }

  metadata_options {
    gce_http_endpoint = 1
  }

  image {
    url     = "cr.yandex/${yandex_container_registry.portal.id}/updatingspace-portal-${each.key}:${local.image_tags[each.key]}"
    command = ["/app/bin/serverless-task.sh"]
    args    = ["purge_retention"]
    environment = lookup({
      access       = local.access_env
      activity     = local.activity_env
      bff          = local.bff_env
      events       = local.events_env
      featureflags = local.featureflags_env
      gamification = local.gamification_env
      portal       = local.portal_env
      voting       = local.voting_env
    }, each.key)
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "DJANGO_SECRET_KEY"
    environment_variable = "DJANGO_SECRET_KEY"
  }

  secrets {
    id                   = yandex_lockbox_secret.runtime.id
    version_id           = yandex_lockbox_secret_version.runtime.id
    key                  = "BFF_INTERNAL_HMAC_SECRET"
    environment_variable = "BFF_INTERNAL_HMAC_SECRET"
  }

  dynamic "secrets" {
    for_each = each.key == "activity" ? [1] : []
    content {
      id                   = yandex_lockbox_secret.runtime.id
      version_id           = yandex_lockbox_secret_version.runtime.id
      key                  = "ACTIVITY_DATA_ENCRYPTION_KEY"
      environment_variable = "ACTIVITY_DATA_ENCRYPTION_KEY"
    }
  }

  dynamic "secrets" {
    for_each = each.key == "activity" ? [1] : []
    content {
      id                   = yandex_lockbox_secret.runtime.id
      version_id           = yandex_lockbox_secret_version.runtime.id
      key                  = "S3_ACCESS_KEY_ID"
      environment_variable = "S3_ACCESS_KEY_ID"
    }
  }

  dynamic "secrets" {
    for_each = each.key == "activity" ? [1] : []
    content {
      id                   = yandex_lockbox_secret.runtime.id
      version_id           = yandex_lockbox_secret_version.runtime.id
      key                  = "S3_SECRET_ACCESS_KEY"
      environment_variable = "S3_SECRET_ACCESS_KEY"
    }
  }

  dynamic "secrets" {
    for_each = each.key == "bff" ? [1] : []
    content {
      id                   = yandex_lockbox_secret.runtime.id
      version_id           = yandex_lockbox_secret_version.runtime.id
      key                  = "BFF_UPDSPACEID_CALLBACK_SECRET"
      environment_variable = "BFF_UPDSPACEID_CALLBACK_SECRET"
    }
  }

  dynamic "secrets" {
    for_each = each.key == "bff" ? [1] : []
    content {
      id                   = yandex_lockbox_secret.runtime.id
      version_id           = yandex_lockbox_secret_version.runtime.id
      key                  = "BFF_OIDC_CLIENT_SECRET"
      environment_variable = "BFF_OIDC_CLIENT_SECRET"
    }
  }

  log_options {
    log_group_id = yandex_logging_group.portal.id
    min_level    = "INFO"
  }
}

resource "yandex_message_queue" "outbox" {
  for_each = local.outbox_services

  access_key                 = yandex_iam_service_account_static_access_key.automation.access_key
  secret_key                 = yandex_iam_service_account_static_access_key.automation.secret_key
  name                       = "${local.name_prefix}-${each.key}-outbox"
  message_retention_seconds  = var.ymq_message_retention_seconds
  visibility_timeout_seconds = var.ymq_visibility_timeout_seconds
  receive_wait_time_seconds  = var.ymq_receive_wait_seconds
}

resource "yandex_function_trigger" "outbox_queue" {
  for_each = local.outbox_services

  name = "${local.name_prefix}-${each.key}-queue-trigger"

  container {
    id                 = yandex_serverless_container.outbox_task[each.key].id
    service_account_id = yandex_iam_service_account.trigger.id
  }

  message_queue {
    queue_id           = yandex_message_queue.outbox[each.key].arn
    service_account_id = yandex_iam_service_account.trigger.id
    batch_cutoff       = var.ymq_batch_cutoff
    batch_size         = var.ymq_batch_size
  }
}

resource "yandex_function_trigger" "outbox_sweep" {
  for_each = local.outbox_services

  name = "${local.name_prefix}-${each.key}-outbox-sweep"

  container {
    id                 = yandex_serverless_container.outbox_task[each.key].id
    service_account_id = yandex_iam_service_account.trigger.id
  }

  timer {
    cron_expression = var.outbox_sweep_cron
  }
}

resource "yandex_function_trigger" "retention" {
  for_each = local.retention_services

  name = "${local.name_prefix}-${each.key}-retention"

  container {
    id                 = yandex_serverless_container.retention_task[each.key].id
    service_account_id = yandex_iam_service_account.trigger.id
  }

  timer {
    cron_expression = var.retention_cron
  }
}

resource "yandex_api_gateway" "portal" {
  name        = "${local.name_prefix}-gateway"
  description = "Portal shared gateway for wildcard tenant routing and Object Storage frontend delivery"
  spec        = local.api_gateway_spec

  dynamic "custom_domains" {
    for_each = var.certificate_id != "" ? [1] : []
    content {
      fqdn           = "*.${var.public_zone}"
      certificate_id = var.certificate_id
    }
  }
}

resource "yandex_dns_zone" "public" {
  count = var.manage_dns_zone ? 1 : 0

  name        = "${replace(local.name_prefix, "-", "")}-public"
  description = "Public DNS zone for ${var.public_zone}"
  zone        = "${var.public_zone}."
  public      = true
}

resource "yandex_dns_recordset" "gateway_wildcard" {
  count = var.manage_dns_zone && var.certificate_id != "" ? 1 : 0

  zone_id = yandex_dns_zone.public[0].id
  name    = "*.${var.public_zone}."
  type    = "CNAME"
  ttl     = 300
  data    = [yandex_api_gateway.portal.domain]
}
