# pages/urls.py
from django.urls import path

from .views import homeView,mapView

urlpatterns = [
    path('', homeView, name='home'),
    path('map', mapView, name='map')
]
