variable "cloud_id" {
  description = "Yandex Cloud ID."
  type        = string
}

variable "folder_id" {
  description = "Folder ID where the portal stack will be deployed."
  type        = string
}

variable "region" {
  description = "Primary YC region."
  type        = string
  default     = "ru-central1"
}

variable "default_zone" {
  description = "Primary availability zone for subnet-backed services."
  type        = string
  default     = "ru-central1-a"
}

variable "name_prefix" {
  description = "Shared prefix for all Yandex Cloud resources in this stack."
  type        = string
  default     = "updspace-portal"
}

variable "public_zone" {
  description = "Public DNS zone used for tenant wildcard routing."
  type        = string
  default     = "updspace.com"
}

variable "manage_dns_zone" {
  description = "Create and manage a public Cloud DNS zone plus wildcard record in this stack."
  type        = bool
  default     = false
}

variable "certificate_id" {
  description = "Existing wildcard certificate ID from Certificate Manager for *.public_zone."
  type        = string
  default     = ""
}

variable "id_public_base_url" {
  description = "Public base URL of the external UpdSpaceID deployment, without /api/v1."
  type        = string
}

variable "id_internal_api_url" {
  description = "Optional internal API URL for UpdSpaceID, including /api/v1. Defaults to id_public_base_url + /api/v1."
  type        = string
  default     = ""
}

variable "serverless_subnet_cidr" {
  description = "Subnet CIDR for serverless resources."
  type        = string
  default     = "10.10.0.0/24"
}

variable "ydb_database_name" {
  description = "Serverless YDB database name."
  type        = string
  default     = "updspace-portal"
}

variable "frontend_bucket_name" {
  description = "Optional explicit Object Storage bucket name for portal frontend assets."
  type        = string
  default     = ""
}

variable "media_bucket_name" {
  description = "Optional explicit Object Storage bucket name for activity/news media assets."
  type        = string
  default     = ""
}

variable "object_storage_force_destroy" {
  description = "Allow Terraform to delete Object Storage buckets even when they still contain data. Keep disabled for production."
  type        = bool
  default     = false
}

variable "container_image_tags" {
  description = "Container image tags by service name."
  type        = map(string)
  default     = {}
}

variable "service_environment" {
  description = "Additional plain-text environment variables by service name."
  type        = map(map(string))
  default     = {}
}

variable "service_memory_mb" {
  description = "HTTP container memory by service name in MB."
  type        = map(number)
  default     = {}
}

variable "service_cores" {
  description = "HTTP container cores by service name."
  type        = map(number)
  default     = {}
}

variable "service_concurrency" {
  description = "HTTP container concurrency by service name."
  type        = map(number)
  default     = {}
}

variable "min_ready_instances" {
  description = "Prepared instances by service name. Use for BFF and other latency-sensitive services."
  type        = map(number)
  default = {
    bff = 1
  }
}

variable "task_memory_mb" {
  description = "Memory for task-mode containers in MB."
  type        = number
  default     = 512
}

variable "task_execution_timeout" {
  description = "Execution timeout for task-mode containers."
  type        = string
  default     = "900s"
}

variable "outbox_services" {
  description = "Services that own outbox queues and YMQ triggers."
  type        = set(string)
  default = [
    "activity",
    "events",
    "featureflags",
    "gamification",
    "voting",
  ]
}

variable "retention_services" {
  description = "Services that get nightly purge_retention timer tasks."
  type        = set(string)
  default = [
    "access",
    "activity",
    "bff",
    "events",
    "featureflags",
    "gamification",
    "portal",
    "voting",
  ]
}

variable "ymq_message_retention_seconds" {
  description = "YMQ message retention for outbox wake-up queues."
  type        = number
  default     = 345600
}

variable "ymq_visibility_timeout_seconds" {
  description = "YMQ visibility timeout for outbox wake-up queues."
  type        = number
  default     = 120
}

variable "ymq_receive_wait_seconds" {
  description = "YMQ long polling wait time in seconds."
  type        = number
  default     = 10
}

variable "ymq_batch_size" {
  description = "Max number of queue messages in one YMQ trigger batch."
  type        = number
  default     = 10
}

variable "ymq_batch_cutoff" {
  description = "Max time to accumulate YMQ trigger batches."
  type        = string
  default     = "10s"
}

variable "outbox_sweep_cron" {
  description = "Cron schedule for outbox sweep safety-net triggers."
  type        = string
  default     = "0 */15 * ? * *"
}

variable "retention_cron" {
  description = "Cron schedule for nightly retention purge triggers."
  type        = string
  default     = "0 0 3 ? * *"
}

variable "log_retention_period" {
  description = "Cloud Logging group retention period."
  type        = string
  default     = "168h"
}

variable "lockbox_secret_entries" {
  description = "Plain-text runtime secrets placed into Lockbox and mounted into containers."
  type        = map(string)
  default     = {}
  sensitive   = true
}
