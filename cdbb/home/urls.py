# home/urls.py
from django.urls import path

from .views import HomeView, AboutView, AccountView

urlpatterns = [
    path('', HomeView.as_view(), name='home'),
    path('about', AboutView.as_view(), name='about'),
    path('account', AccountView.as_view(), name='account')
]
