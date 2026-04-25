#!/bin/bash

# EPCID Server Run Script
# Usage: ./scripts/run.sh [dev|prod|migrate]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[EPCID]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if virtual environment exists
check_venv() {
    if [ ! -d "venv" ] && [ ! -d ".venv" ]; then
        print_warning "Virtual environment not found. Creating one..."
        python3 -m venv venv
        source venv/bin/activate
        pip install --upgrade pip
        pip install -r requirements.txt
    fi
}

# Load environment variables
load_env() {
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
        print_status "Loaded environment from .env"
    else
        print_warning ".env file not found, using defaults"
    fi
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    alembic upgrade head
    print_status "Migrations complete"
}

# Initialize database
init_db() {
    print_status "Initializing database..."
    python -c "from src.db.database import init_db; init_db()"
    print_status "Database initialized"
}

# Run development server
run_dev() {
    print_status "Starting EPCID API in development mode..."
    print_status "API Documentation: http://localhost:8090/docs"
    print_status "ReDoc: http://localhost:8090/redoc"
    uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8090
}

# Run production server
run_prod() {
    print_status "Starting EPCID API in production mode..."
    gunicorn src.api.main:app \
        -w 4 \
        -k uvicorn.workers.UvicornWorker \
        --bind 0.0.0.0:8090 \
        --access-logfile - \
        --error-logfile - \
        --capture-output
}

# Generate synthetic data
generate_data() {
    print_status "Generating synthetic data..."
    python -m src.data.synthea_generator --patients 100 --output data/synthetic_dataset.json
    print_status "Data generation complete"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    pytest tests/ -v --cov=src --cov-report=term-missing
}

# Run frontend development server
run_frontend() {
    print_status "Starting Next.js frontend on port 3011..."
    cd frontend && npm run dev -- -p 3011
}

# Run both backend and frontend
run_full() {
    print_status "Starting full stack (backend + frontend)..."
    print_status "Backend API: http://localhost:8090"
    print_status "Frontend: http://localhost:3011"
    print_status "Swagger Docs: http://localhost:8090/docs"
    print_status "ReDoc: http://localhost:8090/redoc"
    
    # Start backend in background
    uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8090 &
    BACKEND_PID=$!
    
    # Wait for backend to start
    sleep 3
    
    # Start frontend on port 3011
    cd frontend && npm run dev -- -p 3011 &
    FRONTEND_PID=$!
    
    # Trap to clean up on exit
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
    
    # Wait for both
    wait
}

# Main script
case "${1:-dev}" in
    dev)
        check_venv
        load_env
        init_db
        run_dev
        ;;
    prod)
        load_env
        run_migrations
        run_prod
        ;;
    migrate)
        load_env
        run_migrations
        ;;
    init)
        check_venv
        load_env
        init_db
        print_status "Setup complete!"
        ;;
    generate)
        load_env
        generate_data
        ;;
    test)
        load_env
        run_tests
        ;;
    docker)
        print_status "Starting with Docker Compose (PostgreSQL + Redis + API + Frontend)..."
        print_status "Frontend: http://localhost:3011"
        print_status "Backend API: http://localhost:8090"
        print_status "Swagger Docs: http://localhost:8090/docs"
        print_status "ReDoc: http://localhost:8090/redoc"
        print_status "PostgreSQL: localhost:5432"
        print_status "Redis: localhost:6379"
        docker compose up --build
        ;;
    frontend)
        run_frontend
        ;;
    full)
        check_venv
        load_env
        init_db
        run_full
        ;;
    *)
        echo "Usage: $0 {dev|prod|migrate|init|generate|test|docker|frontend|full}"
        echo ""
        echo "Commands:"
        echo "  dev       - Run backend API in development mode"
        echo "  prod      - Run backend API in production mode"
        echo "  frontend  - Run Next.js frontend only"
        echo "  full      - Run both backend and frontend together"
        echo "  docker    - Run everything with Docker Compose (PostgreSQL + Redis + API + Frontend)"
        echo "  migrate   - Run database migrations"
        echo "  init      - Initialize database"
        echo "  generate  - Generate synthetic test data"
        echo "  test      - Run test suite"
        exit 1
        ;;
esac
