from django.http import JsonResponse
from django.urls import path
from events.api import api as events_router

urlpatterns = [
    path("api/v1/", events_router.urls),
    path("health", lambda request: JsonResponse({"status": "ok"})),
]
