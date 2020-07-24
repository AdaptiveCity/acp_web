# home/urls.py
from django.urls import path

from .views import HomeView, AboutView, ResearchView, AccountView

urlpatterns = [
    path('', HomeView.as_view(), name='home'),
    path('about', AboutView.as_view(), name='about'),
    path('research', ResearchView.as_view(), name='research'),
    path('account', AccountView.as_view(), name='account')
]
