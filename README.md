# Installation guide

## Backend (Django + Django REST Framework)
```sh
# Step 1: Create and activate virtual environment
python3 -m venv env
source env/bin/activate

# Step 2: Go into project folder
cd project

# Step 3: Install backend dependencies
pip install -r requirements.txt

# Step 4: Make and apply migrations
python manage.py makemigrations
python manage.py migrate

# Step 5 (optional): Create a superuser for admin panel
python manage.py createsuperuser

# (Step 6: Run the backend server)
python manage.py runserver

# Step 6: Allow OAuth on localhost (only for testing)
export OAUTHLIB_INSECURE_TRANSPORT=1

# Step 7: Start with Daphne + your ASGI app (for WebSocket support)
DJANGO_SETTINGS_MODULE=webapps.settings daphne -p 8000 webapps.asgi:application

# Backend runs at http://localhost:8000
# Django REST FrameWork at localhost:8000/wel/
```

## Frontend (React)
```sh
#  Step 1: In a new terminal window
cd coffeechat-frontend

#  Step 2: Install frontend dependencies
npm install

#  Step 3: Start the React development server
npm start
# Frontend runs at http://localhost:3000
```
