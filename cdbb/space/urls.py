# space/urls.py
from django.urls import path

from .views import MapView, BuildingView, FloorView, FloorspaceView, RainView, SplashView

urlpatterns = [
    path('map/', MapView.as_view(), name='space_map'),
    path('building/<crate_id>/', BuildingView.as_view(), name='space_building'),
    path('floor/<crate_id>/', FloorView.as_view(), name='space_floor'),
    path('floorspace/<crate_id>/', FloorspaceView.as_view(), name='space_floorspace'),
    path('floor_rain/<crate_id>/', RainView.as_view(), name='space_rain'),
    path('floor_splash/<crate_id>/', SplashView.as_view(), name='space_splash')
]
