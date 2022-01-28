# space/urls.py
from django.urls import path

from .views import HomeView, MapView, BuildingView, FloorView, FloorspaceView, RainHomeView, RainView, SplashHomeView, SplashView, RotasView

urlpatterns = [
    path('home/', HomeView.as_view(), name='space_home'),
    path('map/', MapView.as_view(), name='space_map'),
    path('rain_home/', RainHomeView.as_view(), name='space_rain_home'),
    path('splash_home/', SplashHomeView.as_view(), name='space_splash_home'),
    path('building/<crate_id>/', BuildingView.as_view(), name='space_building'),
    path('floor/<crate_id>/', FloorView.as_view(), name='space_floor'),
    path('floorspace/<crate_id>/', FloorspaceView.as_view(), name='space_floorspace'),
    path('rain_home/', RainHomeView.as_view(), name='space_rain_home'),
    path('splash_home/', SplashHomeView.as_view(), name='space_splash_home'),
    path('floor_rain/<crate_id>/', RainView.as_view(), name='space_rain'),
    path('floor_splash/<crate_id>/', SplashView.as_view(), name='space_splash'),
    path('rotas/<crate_id>/', RotasView.as_view(), name='space_rotas')

]
