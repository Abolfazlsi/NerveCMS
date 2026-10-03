import os
from decouple import config
from django.core.asgi import get_asgi_application

django_env = config("DJANGO_ENV", default="development")

if django_env == "production":
    settings_module = "crm_project.settings.production"
else:
    settings_module = "crm_project.settings.development"

os.environ.setdefault('DJANGO_SETTINGS_MODULE', settings_module)

application = get_asgi_application()
