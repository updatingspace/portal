import uuid

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from ninja import Body, Query, Router
from ninja.errors import HttpError

from core.schemas import ErrorOut
from portal.access import AccessService
from portal.context import PortalContext
from portal.enums import TeamStatus, Visibility
from portal.models import (
    Community,
    CommunityMembership,
    PortalProfile,
    Post,
    Team,
    TeamMembership,
)
from portal.schemas import (
    CommunityCreateIn,
    CommunityOut,
    MembershipCheckOut,
    MembershipUpsertIn,
    ModuleItem,
    ModulesOut,
    PostCreateIn,
    PostOut,
    PortalProfileOut,
    PortalProfileUpdateIn,
    TeamCreateIn,
    TeamOut,
)
from portal.security import bff_context_auth
from portal.services import ensure_tenant
from core.errors import error_payload

router = Router(tags=["Portal"], auth=[bff_context_auth])
REQUIRED_BODY = Body(...)


def _ctx(request) -> PortalContext:
    ctx = getattr(request, "auth", None)
    if not isinstance(ctx, PortalContext):
        raise HttpError(401, error_payload("UNAUTHORIZED", "Missing auth context"))
    return ctx


def _require_community_member(tenant, community_id, user_id) -> None:
    if not CommunityMembership.objects.filter(
        tenant=tenant, community_id=community_id, user_id=user_id
    ).exists():
        raise HttpError(403, error_payload("FORBIDDEN", "Not a community member"))


def _require_team_member(tenant, team_id, user_id) -> None:
    if not TeamMembership.objects.filter(tenant=tenant, team_id=team_id, user_id=user_id).exists():
        raise HttpError(403, error_payload("FORBIDDEN", "Not a team member"))


@router.get(
    "/portal/me",
    response={200: PortalProfileOut, 401: ErrorOut, 400: ErrorOut},
    operation_id="portal_me_get",
)
def portal_me_get(request):
    ctx = _ctx(request)
    tenant = ensure_tenant(ctx)
    profile, _ = PortalProfile.objects.get_or_create(
        tenant=tenant,
        user_id=ctx.user_id,
        defaults={
            "first_name": "",
            "last_name": "",
            "bio": None,
            "created_at": timezone.now(),
            "updated_at": timezone.now(),
        },
    )
    return PortalProfileOut(
        tenant_id=profile.tenant_id,
        user_id=profile.user_id,
        first_name=profile.first_name,
        last_name=profile.last_name,
        bio=profile.bio,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.patch(
    "/portal/me",
    response={200: PortalProfileOut, 401: ErrorOut, 400: ErrorOut},
    operation_id="portal_me_patch",
)
@transaction.atomic
def portal_me_patch(request, payload: PortalProfileUpdateIn = REQUIRED_BODY):
    ctx = _ctx(request)
    tenant = ensure_tenant(ctx)
    profile, _ = PortalProfile.objects.get_or_create(
        tenant=tenant,
        user_id=ctx.user_id,
        defaults={
            "first_name": "",
            "last_name": "",
            "bio": None,
            "created_at": timezone.now(),
            "updated_at": timezone.now(),
        },
    )
    updates: dict = {"updated_at": timezone.now()}
    if payload.first_name is not None:
        updates["first_name"] = payload.first_name
    if payload.last_name is not None:
        updates["last_name"] = payload.last_name
    if payload.bio is not None:
        updates["bio"] = payload.bio
    PortalProfile.objects.filter(id=profile.id).update(**updates)
    profile.refresh_from_db()
    return PortalProfileOut(
        tenant_id=profile.tenant_id,
        user_id=profile.user_id,
        first_name=profile.first_name,
        last_name=profile.last_name,
        bio=profile.bio,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.get(
    "/portal/profiles",
    response={200: list[PortalProfileOut], 401: ErrorOut, 400: ErrorOut, 403: ErrorOut},
    operation_id="portal_profiles_list",
)
def portal_profiles_list(
    request,
    q: str | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
):
    ctx = _ctx(request)
    tenant = ensure_tenant(ctx)
    AccessService.check(
        ctx,
        "portal.roles.read",
        scope_type="TENANT",
        scope_id=str(ctx.tenant_id),
    )

    qs = PortalProfile.objects.filter(tenant=tenant)
    if q:
        q = q.strip()
        if q:
            filters = Q(first_name__icontains=q) | Q(last_name__icontains=q)
            try:
                parsed_user_id = uuid.UUID(q)
            except ValueError:
                parsed_user_id = None
            if parsed_user_id:
                filters = filters | Q(user_id=parsed_user_id)
            qs = qs.filter(filters)

    profiles = qs.order_by("last_name", "first_name", "user_id")[:limit]
    return [
        PortalProfileOut(
            tenant_id=profile.tenant_id,
            user_id=profile.user_id,
            first_name=profile.first_name,
            last_name=profile.last_name,
            bio=profile.bio,
            created_at=profile.created_at,
            updated_at=profile.updated_at,
        )
        for profile in profiles
    ]


@router.get(
    "/portal/modules",
    response={200: ModulesOut, 401: ErrorOut, 400: ErrorOut},
    operation_id="portal_modules_get",
)
def portal_modules_get(request):
    ctx = _ctx(request)
    ensure_tenant(ctx)

    modules = [
        ModuleItem(key="profile", enabled=True),
        ModuleItem(key="communities", enabled=True),
        ModuleItem(key="teams", enabled=True),
        ModuleItem(key="posts", enabled=True),
    ]
    return ModulesOut(modules=modules)


@router.get(
    "/communities",
    response={200: list[CommunityOut], 401: ErrorOut, 400: ErrorOut, 403: ErrorOut},
    operation_id="portal_communities_list",
)
def communities_list(request):
    ctx = _ctx(request)
    tenant = ensure_tenant(ctx)
    AccessService.check(
        ctx,
        "portal.communities.list",
        scope_type="TENANT",
        scope_id=str(ctx.tenant_id),
    )
    items = Community.objects.filter(tenant=tenant).order_by("name")
    return [
        CommunityOut(
            id=c.id,
            tenant_id=c.tenant_id,
            name=c.name,
            description=c.description,
            created_by=c.created_by,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in items
    ]


@router.post(
    "/communities",
    response={200: CommunityOut, 401: ErrorOut, 400: ErrorOut, 403: ErrorOut, 409: ErrorOut},
    operation_id="portal_communities_create",
)
@transaction.atomic
def communities_create(request, payload: CommunityCreateIn = REQUIRED_BODY):
    ctx = _ctx(request)
    tenant = ensure_tenant(ctx)
    AccessService.check(
        ctx,
        "portal.communities.create",
        scope_type="TENANT",
        scope_id=str(ctx.tenant_id),
    )
    try:
        c = Community.objects.create(
            tenant=tenant,
            name=payload.name,
            description=payload.description or "",
            created_by=ctx.user_id,
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )
    except Exception as exc:
        raise HttpError(409, error_payload("DUPLICATE", "Community already exists")) from exc

    return CommunityOut(
        id=c.id,
        tenant_id=c.tenant_id,
        name=c.name,
        description=c.description,
        created_by=c.created_by,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


@router.get(
    "/communities/{community_id}",
    response={200: CommunityOut, 401: ErrorOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    operation_id="portal_communities_get",
)
def communities_get(request, community_id: str):
    ctx = _ctx(request)
    tenant = ensure_tenant(ctx)
    AccessService.check(
        ctx,
        "portal.communities.read",
        scope_type="TENANT",
        scope_id=str(ctx.tenant_id),
    )
    try:
        c = Community.objects.get(id=community_id, tenant=tenant)
    except Community.DoesNotExist:
        raise HttpError(404, error_payload("NOT_FOUND", "Community not found")) from None

    return CommunityOut(
        id=c.id,
        tenant_id=c.tenant_id,
        name=c.name,
        description=c.description,
        created_by=c.created_by,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


@router.get(
    "/communities/{community_id}/members/{user_id}",
    response={200: MembershipCheckOut, 401: ErrorOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    operation_id="portal_communities_members_get",
)
def communities_members_get(request, community_id: str, user_id: str):
    ctx = _ctx(request)
    tenant = ensure_tenant(ctx)
    AccessService.check(
        ctx,
        "portal.communities.members.read",
        scope_type="COMMUNITY",
        scope_id=str(community_id),
    )
    try:
        community = Community.objects.get(id=community_id, tenant=tenant)
    except Community.DoesNotExist:
        raise HttpError(404, error_payload("NOT_FOUND", "Community not found")) from None

    membership = CommunityMembership.objects.filter(
        tenant=tenant, community=community, user_id=user_id
    ).first()
    if not membership:
        raise HttpError(404, error_payload("NOT_FOUND", "Membership not found"))

    return MembershipCheckOut(member=True, role_hint=membership.role_hint)


@router.post(
    "/communities/{community_id}/members",
    response={200: dict, 401: ErrorOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    operation_id="portal_communities_members_upsert",
)
@transaction.atomic
def communities_members_upsert(request, community_id: str, payload: MembershipUpsertIn = REQUIRED_BODY):
    ctx = _ctx(request)
    tenant = ensure_tenant(ctx)
    AccessService.check(
        ctx,
        "portal.communities.members.manage",
        scope_type="COMMUNITY",
        scope_id=str(community_id),
    )
    try:
        community = Community.objects.get(id=community_id, tenant=tenant)
    except Community.DoesNotExist:
        raise HttpError(404, error_payload("NOT_FOUND", "Community not found")) from None

    if payload.action == "remove":
        CommunityMembership.objects.filter(
            tenant=tenant, community=community, user_id=payload.user_id
        ).delete()
        return {"ok": True}

    CommunityMembership.objects.update_or_create(
        tenant=tenant,
        community=community,
        user_id=payload.user_id,
        defaults={"role_hint": payload.role_hint},
    )
    return {"ok": True}


@router.get(
    "/teams",
    response={200: list[TeamOut], 401: ErrorOut, 400: ErrorOut, 403: ErrorOut},
    operation_id="portal_teams_list",
)
def teams_list(request, community_id: str = Query(...)):
    ctx = _ctx(request)
    tenant = ensure_tenant(ctx)
    AccessService.check(
        ctx,
        "portal.teams.list",
        scope_type="COMMUNITY",
        scope_id=str(community_id),
    )

    teams = Team.objects.filter(tenant=tenant, community_id=community_id).order_by("name")
    return [
        TeamOut(
            id=t.id,
            tenant_id=t.tenant_id,
            community_id=t.community_id,
            name=t.name,
            status=t.status,
            created_by=t.created_by,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in teams
    ]


@router.post(
    "/teams",
    response={200: TeamOut, 401: ErrorOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut, 409: ErrorOut},
    operation_id="portal_teams_create",
)
@transaction.atomic
def teams_create(request, payload: TeamCreateIn = REQUIRED_BODY):
    ctx = _ctx(request)
    tenant = ensure_tenant(ctx)
    AccessService.check(
        ctx,
        "portal.teams.create",
        scope_type="COMMUNITY",
        scope_id=str(payload.community_id),
    )
    try:
        community = Community.objects.get(id=payload.community_id, tenant=tenant)
    except Community.DoesNotExist:
        raise HttpError(404, error_payload("NOT_FOUND", "Community not found")) from None

    try:
        t = Team.objects.create(
            tenant=tenant,
            community=community,
            name=payload.name,
            status=TeamStatus.ACTIVE,
            created_by=ctx.user_id,
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )
    except Exception as exc:
        raise HttpError(409, error_payload("DUPLICATE", "Team already exists")) from exc

    return TeamOut(
        id=t.id,
        tenant_id=t.tenant_id,
        community_id=t.community_id,
        name=t.name,
        status=t.status,
        created_by=t.created_by,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.post(
    "/teams/{team_id}/members",
    response={200: dict, 401: ErrorOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    operation_id="portal_teams_members_upsert",
)
@transaction.atomic
def teams_members_upsert(request, team_id: str, payload: MembershipUpsertIn = REQUIRED_BODY):
    ctx = _ctx(request)
    tenant = ensure_tenant(ctx)
    AccessService.check(
        ctx,
        "portal.teams.members.manage",
        scope_type="TEAM",
        scope_id=str(team_id),
    )
    try:
        team = Team.objects.get(id=team_id, tenant=tenant)
    except Team.DoesNotExist:
        raise HttpError(404, error_payload("NOT_FOUND", "Team not found")) from None

    if payload.action == "remove":
        TeamMembership.objects.filter(tenant=tenant, team=team, user_id=payload.user_id).delete()
        return {"ok": True}

    TeamMembership.objects.update_or_create(
        tenant=tenant,
        team=team,
        user_id=payload.user_id,
        defaults={"role_hint": payload.role_hint},
    )
    return {"ok": True}


@router.get(
    "/teams/{team_id}/members/{user_id}",
    response={200: MembershipCheckOut, 401: ErrorOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    operation_id="portal_teams_members_get",
)
def teams_members_get(request, team_id: str, user_id: str):
    ctx = _ctx(request)
    tenant = ensure_tenant(ctx)
    AccessService.check(
        ctx,
        "portal.teams.members.read",
        scope_type="TEAM",
        scope_id=str(team_id),
    )
    try:
        team = Team.objects.get(id=team_id, tenant=tenant)
    except Team.DoesNotExist:
        raise HttpError(404, error_payload("NOT_FOUND", "Team not found")) from None

    membership = TeamMembership.objects.filter(tenant=tenant, team=team, user_id=user_id).first()
    if not membership:
        raise HttpError(404, error_payload("NOT_FOUND", "Membership not found"))

    return MembershipCheckOut(member=True, role_hint=membership.role_hint)



@router.get(
    "/posts",
    response={200: list[PostOut], 401: ErrorOut, 400: ErrorOut, 403: ErrorOut},
    operation_id="portal_posts_list",
)
def posts_list(
    request,
    scope: str = Query("public"),
    community_id: str | None = Query(None),
    team_id: str | None = Query(None),
):
    ctx = _ctx(request)
    tenant = ensure_tenant(ctx)

    include_private = False
    try:
        AccessService.check(
            ctx,
            "portal.posts.read_private",
            scope_type="TENANT",
            scope_id=str(ctx.tenant_id),
        )
        include_private = True
    except HttpError:
        include_private = False

    qs = Post.objects.filter(tenant=tenant).order_by("-created_at")

    if scope == "public":
        qs = qs.filter(visibility=Visibility.PUBLIC)
    elif scope == "community":
        if not community_id:
            raise HttpError(400, error_payload("VALIDATION_ERROR", "community_id is required"))
        _require_community_member(tenant, community_id, ctx.user_id)
        vis = Q(visibility=Visibility.PUBLIC) | Q(visibility=Visibility.COMMUNITY)
        if include_private:
            vis = vis | Q(visibility=Visibility.PRIVATE)
        qs = qs.filter(community_id=community_id).filter(vis)
    elif scope == "team":
        if not team_id:
            raise HttpError(400, error_payload("VALIDATION_ERROR", "team_id is required"))
        _require_team_member(tenant, team_id, ctx.user_id)
        vis = Q(visibility=Visibility.PUBLIC) | Q(visibility=Visibility.TEAM)
        if include_private:
            vis = vis | Q(visibility=Visibility.PRIVATE)
        qs = qs.filter(team_id=team_id).filter(vis)
    else:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "scope must be public|community|team"))

    return [
        PostOut(
            id=p.id,
            tenant_id=p.tenant_id,
            community_id=p.community_id,
            team_id=p.team_id,
            title=p.title,
            body=p.body,
            visibility=p.visibility,
            created_by=p.created_by,
            created_at=p.created_at,
        )
        for p in qs
    ]


@router.post(
    "/posts",
    response={200: PostOut, 401: ErrorOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    operation_id="portal_posts_create",
)
@transaction.atomic
def posts_create(request, payload: PostCreateIn = REQUIRED_BODY):
    ctx = _ctx(request)
    tenant = ensure_tenant(ctx)

    if payload.visibility == Visibility.PUBLIC:
        AccessService.check(ctx, "portal.posts.create_public", scope_type="TENANT", scope_id=str(ctx.tenant_id))
        community = None
        team = None
    elif payload.visibility == Visibility.COMMUNITY:
        if not payload.community_id:
            raise HttpError(400, error_payload("VALIDATION_ERROR", "community_id is required"))
        AccessService.check(
            ctx,
            "portal.posts.create_community",
            scope_type="COMMUNITY",
            scope_id=str(payload.community_id),
        )
        try:
            community = Community.objects.get(id=payload.community_id, tenant=tenant)
        except Community.DoesNotExist:
            raise HttpError(404, error_payload("NOT_FOUND", "Community not found")) from None
        team = None
    elif payload.visibility == Visibility.TEAM:
        if not payload.team_id:
            raise HttpError(400, error_payload("VALIDATION_ERROR", "team_id is required"))
        AccessService.check(
            ctx,
            "portal.posts.create_team",
            scope_type="TEAM",
            scope_id=str(payload.team_id),
        )
        try:
            team = Team.objects.get(id=payload.team_id, tenant=tenant)
        except Team.DoesNotExist:
            raise HttpError(404, error_payload("NOT_FOUND", "Team not found")) from None
        community = team.community
    elif payload.visibility == Visibility.PRIVATE:
        AccessService.check(ctx, "portal.posts.create_private", scope_type="TENANT", scope_id=str(ctx.tenant_id))
        community = None
        team = None
    else:
        raise HttpError(400, error_payload("VALIDATION_ERROR", "Invalid visibility"))

    post = Post.objects.create(
        tenant=tenant,
        community=community,
        team=team,
        title=payload.title,
        body=payload.body,
        visibility=payload.visibility,
        created_by=ctx.user_id,
        created_at=timezone.now(),
    )

    return PostOut(
        id=post.id,
        tenant_id=post.tenant_id,
        community_id=post.community_id,
        team_id=post.team_id,
        title=post.title,
        body=post.body,
        visibility=post.visibility,
        created_by=post.created_by,
        created_at=post.created_at,
    )
