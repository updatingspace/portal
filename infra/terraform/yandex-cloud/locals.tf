locals {
  name_prefix = lower(replace(var.name_prefix, "_", "-"))

  all_services = [
    "access",
    "activity",
    "bff",
    "events",
    "featureflags",
    "gamification",
    "portal",
    "voting",
  ]

  default_allowed_hosts = ".${var.public_zone},.yandexcloud.net,localhost,127.0.0.1"

  frontend_bucket_name = var.frontend_bucket_name != "" ? var.frontend_bucket_name : "${local.name_prefix}-${substr(md5("${var.folder_id}-frontend"), 0, 8)}"
  media_bucket_name    = var.media_bucket_name != "" ? var.media_bucket_name : "${local.name_prefix}-media-${substr(md5("${var.folder_id}-media"), 0, 8)}"

  image_tags = merge({
    for service in local.all_services : service => "latest"
  }, var.container_image_tags)

  service_memory_mb = merge({
    access       = 512
    activity     = 512
    bff          = 1024
    events       = 512
    featureflags = 256
    gamification = 512
    portal       = 512
    voting       = 512
  }, var.service_memory_mb)

  service_cores = merge({
    for service in local.all_services : service => 1
  }, var.service_cores)

  service_concurrency = merge({
    for service in local.all_services : service => 8
  }, var.service_concurrency)

  runtime_secret_entries = merge(
    var.lockbox_secret_entries,
    {
      S3_ACCESS_KEY_ID     = yandex_iam_service_account_static_access_key.automation.access_key
      S3_SECRET_ACCESS_KEY = yandex_iam_service_account_static_access_key.automation.secret_key
    },
  )

  common_service_env = {
    ALLOWED_HOSTS              = local.default_allowed_hosts
    DB_DRIVER                  = "ydb"
    DJANGO_LOG_LEVEL           = "INFO"
    DJANGO_SECURE_SSL_REDIRECT = "1"
    DJANGO_SECURE_HSTS_SECONDS = "31536000"
    S3_REGION                  = var.region
    YDB_CREDENTIALS_MODE       = "metadata"
    YDB_DATABASE               = yandex_ydb_database_serverless.portal.database_path
    YDB_ENDPOINT               = yandex_ydb_database_serverless.portal.ydb_full_endpoint
    YDB_NAME                   = "default"
  }

  id_public_base_url  = trimsuffix(var.id_public_base_url, "/")
  id_internal_api_url = var.id_internal_api_url != "" ? trimsuffix(var.id_internal_api_url, "/") : "${local.id_public_base_url}/api/v1"

  access_api_url       = "${yandex_serverless_container.access.url}/api/v1"
  access_service_url   = yandex_serverless_container.access.url
  portal_api_url       = "${yandex_serverless_container.portal.url}/api/v1"
  featureflags_api_url = "${yandex_serverless_container.featureflags.url}/api/v1"
  activity_api_url     = "${yandex_serverless_container.activity.url}/api/v1"
  activity_service_url = yandex_serverless_container.activity.url
  events_api_url       = "${yandex_serverless_container.events.url}/api/v1"
  gamification_api_url = "${yandex_serverless_container.gamification.url}/api/v1"
  voting_api_url       = "${yandex_serverless_container.voting.url}/api/v1"

  access_env = merge(
    local.common_service_env,
    lookup(var.service_environment, "access", {}),
  )

  portal_env = merge(
    local.common_service_env,
    {
      ACCESS_BASE_URL    = local.access_api_url
      ACCESS_SERVICE_URL = local.access_service_url
    },
    lookup(var.service_environment, "portal", {}),
  )

  featureflags_env = merge(
    local.common_service_env,
    {
      YMQ_OUTBOX_QUEUE = yandex_message_queue.outbox["featureflags"].name
    },
    lookup(var.service_environment, "featureflags", {}),
  )

  activity_env = merge(
    local.common_service_env,
    {
      ACCESS_BASE_URL     = local.access_api_url
      ACCESS_SERVICE_URL  = local.access_service_url
      NEWS_MEDIA_BUCKET   = local.media_bucket_name
      NEWS_MEDIA_PREFIX   = "news"
      S3_ENDPOINT_URL     = "https://storage.yandexcloud.net"
      S3_FORCE_PATH_STYLE = "0"
      YMQ_OUTBOX_QUEUE    = yandex_message_queue.outbox["activity"].name
    },
    lookup(var.service_environment, "activity", {}),
  )

  events_env = merge(
    local.common_service_env,
    {
      ACCESS_BASE_URL    = local.access_api_url
      PORTAL_SERVICE_URL = local.portal_api_url
      YMQ_OUTBOX_QUEUE   = yandex_message_queue.outbox["events"].name
    },
    lookup(var.service_environment, "events", {}),
  )

  gamification_env = merge(
    local.common_service_env,
    {
      ACCESS_BASE_URL      = local.access_api_url
      ACTIVITY_SERVICE_URL = local.activity_api_url
      YMQ_OUTBOX_QUEUE     = yandex_message_queue.outbox["gamification"].name
    },
    lookup(var.service_environment, "gamification", {}),
  )

  voting_env = merge(
    local.common_service_env,
    {
      ACCESS_BASE_URL      = local.access_api_url
      ACTIVITY_SERVICE_URL = local.activity_api_url
      YMQ_OUTBOX_QUEUE     = yandex_message_queue.outbox["voting"].name
    },
    lookup(var.service_environment, "voting", {}),
  )

  bff_env = merge(
    local.common_service_env,
    {
      BFF_COOKIE_DOMAIN                    = ".${var.public_zone}"
      BFF_TENANT_HOST_SUFFIX               = var.public_zone
      BFF_UPSTREAM_ACCESS_INVOKE_URL       = local.access_api_url
      BFF_UPSTREAM_EVENTS_INVOKE_URL       = local.events_api_url
      BFF_UPSTREAM_FEATUREFLAGS_INVOKE_URL = local.featureflags_api_url
      BFF_UPSTREAM_FEED_INVOKE_URL         = local.activity_api_url
      BFF_UPSTREAM_GAMIFICATION_INVOKE_URL = local.gamification_api_url
      BFF_UPSTREAM_PORTAL_INVOKE_URL       = local.portal_api_url
      BFF_UPSTREAM_VOTING_INVOKE_URL       = local.voting_api_url
      BFF_SESSION_RATE_LIMIT_PER_MIN       = "60"
      ID_BASE_URL                          = local.id_internal_api_url
      ID_PUBLIC_BASE_URL                   = local.id_public_base_url
      YC_API_GATEWAY_DOMAIN                = "*.${var.public_zone}"
      YC_CERTIFICATE_ID                    = var.certificate_id
      YC_LOCKBOX_SECRET_RUNTIME_ID         = yandex_lockbox_secret.runtime.id
      YC_LOCKBOX_SECRET_RUNTIME_VERSION_ID = yandex_lockbox_secret_version.runtime.id
    },
    lookup(var.service_environment, "bff", {}),
  )

  outbox_services    = var.outbox_services
  retention_services = var.retention_services

  api_gateway_spec = templatefile("${path.module}/templates/api-gateway.openapi.yaml.tftpl", {
    bff_container_id           = yandex_serverless_container.bff.id
    frontend_bucket            = local.frontend_bucket_name
    gateway_service_account_id = yandex_iam_service_account.gateway.id
  })
}
