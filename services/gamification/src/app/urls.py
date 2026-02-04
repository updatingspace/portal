from django.http import JsonResponse
from django.urls import path

from gamification.api import api as gamification_router

urlpatterns = [
    path("api/v1/", gamification_router.urls),
    path("health", lambda request: JsonResponse({"status": "ok"})),
]
