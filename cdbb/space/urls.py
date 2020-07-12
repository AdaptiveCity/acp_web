# space/urls.py
from django.urls import path

from .views import MapView, BuildingView

urlpatterns = [
    path('map/', MapView.as_view(), name='space_map'),
    path('building/<crate_id>/', BuildingView.as_view(), name='space_building')
]
