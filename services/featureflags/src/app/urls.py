from django.http import JsonResponse
from django.urls import path

from featureflags.api import api as featureflags_router

urlpatterns = [
    path("api/v1/", featureflags_router.urls),
    path("health", lambda request: JsonResponse({"status": "ok"})),
]
