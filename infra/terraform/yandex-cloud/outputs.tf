output "api_gateway_id" {
  description = "API Gateway resource ID."
  value       = yandex_api_gateway.portal.id
}

output "api_gateway_invoke_domain" {
  description = "Default invoke domain assigned by Yandex API Gateway."
  value       = yandex_api_gateway.portal.domain
}

output "public_gateway_domain" {
  description = "Configured wildcard domain when a certificate is attached, otherwise the default invoke domain."
  value       = var.certificate_id != "" ? "*.${var.public_zone}" : yandex_api_gateway.portal.domain
}

output "frontend_bucket_name" {
  description = "Object Storage bucket used for the portal frontend bundle."
  value       = yandex_storage_bucket.frontend.bucket
}

output "media_bucket_name" {
  description = "Object Storage bucket used for activity/news media."
  value       = yandex_storage_bucket.media.bucket
}

output "container_registry_id" {
  description = "Container Registry ID for Yandex Container Registry pushes."
  value       = yandex_container_registry.portal.id
}

output "service_invoke_urls" {
  description = "Private invoke URLs for serverless service containers."
  value = {
    access       = yandex_serverless_container.access.url
    activity     = yandex_serverless_container.activity.url
    bff          = yandex_serverless_container.bff.url
    events       = yandex_serverless_container.events.url
    featureflags = yandex_serverless_container.featureflags.url
    gamification = yandex_serverless_container.gamification.url
    portal       = yandex_serverless_container.portal.url
    voting       = yandex_serverless_container.voting.url
  }
}

output "outbox_queue_arns" {
  description = "YMQ queue ARNs for outbox wake-up triggers."
  value = {
    for service, queue in yandex_message_queue.outbox : service => queue.arn
  }
}

output "ydb_endpoint" {
  description = "YDB endpoint for DB_DRIVER=ydb deployments."
  value       = yandex_ydb_database_serverless.portal.ydb_full_endpoint
}

output "ydb_database" {
  description = "YDB database path for DB_DRIVER=ydb deployments."
  value       = yandex_ydb_database_serverless.portal.database_path
}

output "runtime_lockbox_secret_id" {
  description = "Lockbox secret ID with runtime secrets and static S3 credentials."
  value       = yandex_lockbox_secret.runtime.id
}

output "runtime_lockbox_secret_version_id" {
  description = "Current Lockbox secret version for runtime secret injection."
  value       = yandex_lockbox_secret_version.runtime.id
}

output "service_accounts" {
  description = "Service account IDs created by this Terraform stack."
  value = {
    runtime    = yandex_iam_service_account.runtime.id
    gateway    = yandex_iam_service_account.gateway.id
    trigger    = yandex_iam_service_account.trigger.id
    automation = yandex_iam_service_account.automation.id
    ci         = yandex_iam_service_account.ci.id
  }
}
