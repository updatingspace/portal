#!/usr/bin/env bash
#
# Dev environment startup script
# Usage: ./scripts/dev-up.sh [--id-mode local|remote] [--skip-setup] [--services service1,service2,...]
#
# Examples:
#   ./scripts/dev-up.sh                          # Start all services
#   ./scripts/dev-up.sh --skip-setup             # Skip DB setup (faster restart)
#   ./scripts/dev-up.sh --services bff,portal    # Start only specific services
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE_LOCAL="$PROJECT_ROOT/infra/docker-compose/docker-compose.dev.yml"
COMPOSE_FILE_REMOTE="$PROJECT_ROOT/infra/docker-compose/docker-compose.remote.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
SKIP_SETUP=false
SERVICES=""
ID_MODE="local"

# OIDC client variables are environment-driven in both modes.
BFF_OIDC_CLIENT_SECRET="${BFF_OIDC_CLIENT_SECRET:-}"
BFF_OIDC_CLIENT_ID="${BFF_OIDC_CLIENT_ID:-}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --id-mode)
            ID_MODE="$2"
            shift 2
            ;;
        --skip-setup)
            SKIP_SETUP=true
            shift
            ;;
        --services)
            SERVICES="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--id-mode local|remote] [--skip-setup] [--services service1,service2,...]"
            echo ""
            echo "Options:"
            echo "  --id-mode          ID integration mode:"
            echo "                     local  → run ID services from GHCR images on id.localhost"
            echo "                     remote → use deployed ID service (e.g. id.updspace.com)"
            echo "  --skip-setup       Skip database setup (faster for restarts)"
            echo "  --services         Comma-separated list of services to start"
            echo "                     Available: traefik,redis,db_id,db_bff,db_access,"
            echo "                     db_portal,db_voting,db_events,db_gamification,db_activity,"
            echo "                     updspaceid,bff,access,portal,voting,events,gamification,"
            echo "                     activity,frontend,id-frontend(local mode)"
            echo ""
            echo "Service dependencies:"
            echo "  bff       → redis, db_bff, updspaceid (local mode) / remote ID URL (remote mode)"
            echo "  portal    → db_portal"
            echo "  voting    → db_voting, access"
            echo "  events    → db_events, access"
            echo "  gamification → db_gamification, access"
            echo "  activity  → db_activity"
            echo "  access    → db_access"
            echo "  updspaceid→ db_id, redis"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not available"
        exit 1
    fi
    
    local compose_file="$COMPOSE_FILE_LOCAL"
    if [[ "$ID_MODE" == "remote" ]]; then
        compose_file="$COMPOSE_FILE_REMOTE"
    fi

    if [[ ! -f "$compose_file" ]]; then
        log_error "Docker Compose file not found: $compose_file"
        exit 1
    fi
    
    log_success "Prerequisites OK"
}

# Wait for a service to be healthy
wait_for_service() {
    local service=$1
    local url=$2
    local max_attempts=${3:-30}
    local attempt=1
    
    log_info "Waiting for $service to be ready..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$url" > /dev/null 2>&1; then
            log_success "$service is ready"
            return 0
        fi
        
        echo -n "."
        sleep 1
        ((attempt++))
    done
    
    echo ""
    log_warn "$service did not become ready in time (this may be OK if not started)"
    return 1
}

# Start Docker Compose services
start_services() {
    log_info "Starting Docker Compose services..."

    local compose_file="$COMPOSE_FILE_LOCAL"
    if [[ "$ID_MODE" == "remote" ]]; then
        compose_file="$COMPOSE_FILE_REMOTE"
    fi

    local compose_args="-f $compose_file up -d --build"
    
    if [[ -n "$SERVICES" ]]; then
        # Convert comma-separated to space-separated
        local service_list="${SERVICES//,/ }"
        compose_args="$compose_args $service_list"
        log_info "Starting selected services: $service_list"
    fi
    
    # shellcheck disable=SC2086
    docker compose $compose_args
    
    log_success "Docker Compose started"
}

# Run database setup
setup_databases() {
    if [[ "$SKIP_SETUP" == "true" ]]; then
        log_info "Skipping database setup (--skip-setup)"
        return 0
    fi
    
    log_info "Setting up databases..."
    
    # Wait for ID service to be ready
    sleep 3
    
    local compose_file="$COMPOSE_FILE_LOCAL"
    if [[ "$ID_MODE" == "remote" ]]; then
        compose_file="$COMPOSE_FILE_REMOTE"
    fi

    # Setup ID service database (local mode only)
    if [[ "$ID_MODE" == "local" ]]; then
        log_info "Setting up ID service database..."
        if docker compose -f "$compose_file" exec -T updspaceid python src/manage.py setup_db 2>/dev/null; then
            log_success "ID database setup complete"
        else
            log_warn "ID database setup skipped or already done"
        fi
    fi
    
    # Run migrations for other services
    local services=("bff" "access" "portal" "voting" "events" "gamification" "activity")
    
    for service in "${services[@]}"; do
        if docker compose -f "$compose_file" ps --format '{{.Service}}' | grep -q "^${service}$"; then
            log_info "Running migrations for $service..."
            log_info "Generating all pending migrations for $service..."
            docker compose -f "$compose_file" exec -T "$service" python src/manage.py makemigrations --noinput

            log_info "Applying migrations for $service..."
            docker compose -f "$compose_file" exec -T "$service" python src/manage.py migrate --noinput

            log_success "$service migrations complete"
        fi
    done
}

# Setup OIDC client for portal
setup_oidc_client() {
    if [[ "$SKIP_SETUP" == "true" ]]; then
        return 0
    fi

    local compose_file="$COMPOSE_FILE_LOCAL"
    if [[ "$ID_MODE" == "remote" ]]; then
        log_info "Remote ID mode: skipping local OIDC client bootstrap."
        log_info "Ensure BFF_OIDC_CLIENT_ID/BFF_OIDC_CLIENT_SECRET are provisioned in id.updspace.com."
        return 0
    fi

    log_info "Setting up Portal OIDC client in local ID..."

    if docker compose -f "$compose_file" exec -T updspaceid python src/manage.py setup_portal_client --secret "$BFF_OIDC_CLIENT_SECRET" 2>/dev/null; then
        log_success "Portal OIDC client ready (client_id=$BFF_OIDC_CLIENT_ID)"
    else
        log_warn "Portal OIDC client setup skipped (may already exist)"
    fi
}

# Health check all services
health_check_services() {
    log_info "Checking service health..."
    echo ""
    
    local services=(
        "Traefik:http://localhost:8081/ping"
        "BFF:http://localhost:8080/health"
        "Access:http://localhost:8002/health"
        "Portal:http://localhost:8003/health"
        "Voting:http://localhost:8004/health"
        "Events:http://localhost:8005/health"
        "Activity:http://localhost:8006/health"
        "Portal Frontend:http://localhost:5173"
    )

    if [[ "$ID_MODE" == "local" ]]; then
        services=("Traefik:http://localhost:8081/ping" "ID Service:http://id.localhost/health" "BFF:http://localhost:8080/health" "Access:http://localhost:8002/health" "Portal:http://localhost:8003/health" "Voting:http://localhost:8004/health" "Events:http://localhost:8005/health" "Activity:http://localhost:8006/health" "Portal Frontend:http://localhost:5173" "ID Frontend:http://localhost:5175")
    fi
    
    local all_healthy=true
    
    for entry in "${services[@]}"; do
        local name="${entry%%:*}"
        local url="${entry#*:}"
        
        if curl -sf "$url" > /dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} $name"
        else
            echo -e "  ${RED}✗${NC} $name (not responding)"
            all_healthy=false
        fi
    done
    
    echo ""
    
    if [[ "$all_healthy" == "true" ]]; then
        log_success "All services are healthy"
    else
        log_warn "Some services are not responding (this may be intentional)"
    fi
}

# Print access URLs
print_urls() {
    local compose_file="$COMPOSE_FILE_LOCAL"
    if [[ "$ID_MODE" == "remote" ]]; then
        compose_file="$COMPOSE_FILE_REMOTE"
    fi

    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Development environment is ready!${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Access URLs:"
    echo -e "  ${YELLOW}Portal Frontend${NC}  → http://aef.localhost"
    if [[ "$ID_MODE" == "local" ]]; then
        echo -e "  ${YELLOW}ID Frontend${NC}      → http://id.localhost"
    else
        echo -e "  ${YELLOW}ID Frontend${NC}      → ${ID_PUBLIC_BASE_URL:-https://id.updspace.com}"
    fi
    echo -e "  ${YELLOW}BFF API${NC}          → http://aef.localhost/api/v1/"
    echo -e "  ${YELLOW}Traefik Dashboard${NC}→ http://localhost:8081"
    echo ""
    echo "Quick commands:"
    echo "  docker compose -f $compose_file logs -f <service>  # View logs"
    echo "  docker compose -f $compose_file restart <service>  # Restart service"
    echo "  docker compose -f $compose_file down               # Stop all"
    echo ""
    if [[ "$ID_MODE" == "local" ]]; then
        echo "Dev admin bootstrap (optional):"
        echo "  docker compose -f $compose_file exec updspaceid \\"
        echo "    python src/manage.py issue_admin_magic_link --email dev@aef.local"
    else
        echo "Remote ID mode:"
        echo "  configure BFF_OIDC_CLIENT_ID and BFF_OIDC_CLIENT_SECRET in .env"
        echo "  ensure redirect URI is registered in id.updspace.com:"
        echo "    http://aef.localhost/api/v1/auth/callback"
    fi
    echo ""
}

main() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}         ${GREEN}AEF-Vote Development Environment${NC}                 ${BLUE}║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [[ "$ID_MODE" != "local" && "$ID_MODE" != "remote" ]]; then
        log_error "--id-mode must be 'local' or 'remote'"
        exit 1
    fi

    if [[ "$ID_MODE" == "local" ]]; then
        if [[ -z "$BFF_OIDC_CLIENT_ID" ]]; then
            BFF_OIDC_CLIENT_ID="portal-dev-client"
            export BFF_OIDC_CLIENT_ID
            log_warn "BFF_OIDC_CLIENT_ID is not set, using local default: $BFF_OIDC_CLIENT_ID"
        fi
        if [[ -z "$BFF_OIDC_CLIENT_SECRET" ]]; then
            BFF_OIDC_CLIENT_SECRET="portal-dev-secret"
            export BFF_OIDC_CLIENT_SECRET
            log_warn "BFF_OIDC_CLIENT_SECRET is not set, using local default."
        fi
    else
        if [[ -z "$BFF_OIDC_CLIENT_ID" || -z "$BFF_OIDC_CLIENT_SECRET" ]]; then
            log_error "Remote mode requires BFF_OIDC_CLIENT_ID and BFF_OIDC_CLIENT_SECRET in environment."
            exit 1
        fi
    fi

    log_info "ID mode: $ID_MODE"
    check_prerequisites
    start_services
    
    # Give services time to start
    log_info "Waiting for services to initialize..."
    sleep 5
    
    setup_databases
    setup_oidc_client
    
    # Final health check
    sleep 2
    health_check_services
    
    print_urls
}

main "$@"
