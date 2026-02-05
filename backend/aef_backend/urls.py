"""
URL configuration for aef_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

import os

from allauth.account import views as allauth_account_views
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from ninja import NinjaAPI

from accounts.api import install as install_accounts_api
from accounts.api import router as auth_router
from core.api import router as core_router
from nominations.admin_api import router as admin_router
from nominations.api import router as nominations_router
from nominations.games_api import router as games_router
from votings.api import router as votings_router

api = NinjaAPI(title="AEF Vote API", version="0.1.0")
install_accounts_api(api)


@api.get("/health")
def healthcheck(request):
    return {"status": "ok"}


@api.get("/version")
def version(request):
    """Return application version information including BUILD_ID."""
    build_id = os.environ.get("BUILD_ID", "dev")
    return {
        "build_id": build_id,
        "api_version": "0.1.0",
    }


api.add_router("/nominations", nominations_router)
api.add_router("/votings", votings_router)
api.add_router("/auth", auth_router)
api.add_router("/games", games_router)
api.add_router("/admin", admin_router)
api.add_router("/personalization", core_router)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
    re_path(
        r"^accounts/confirm-email/(?P<key>[-:\w]+)/$",
        allauth_account_views.confirm_email,
        name="account_confirm_email",
    ),
]

if settings.DEBUG and "debug_toolbar" in settings.INSTALLED_APPS:
    urlpatterns.append(path("__debug__/", include("debug_toolbar.urls")))

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
