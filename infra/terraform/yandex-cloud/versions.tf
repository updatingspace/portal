terraform {
  required_version = ">= 1.7.0"

  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }

    yandex = {
      source  = "yandex-cloud/yandex"
      version = "~> 0.196"
    }
  }
}

provider "yandex" {
  cloud_id  = var.cloud_id
  folder_id = var.folder_id
  zone      = var.default_zone
}
