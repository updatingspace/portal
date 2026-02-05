from django.http import JsonResponse
from django.urls import path
from bff.api import api

urlpatterns = [
    # path("admin/", admin.site.urls), # Optional
    path("api/v1/", api.urls),
    path("health", lambda request: JsonResponse({"status": "ok"})),
]
