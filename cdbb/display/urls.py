# space/urls.py
from django.urls import path

from .views import HomeView

urlpatterns = [
    path('home/<display_id>', HomeView.as_view(), name='display_home'),
]
