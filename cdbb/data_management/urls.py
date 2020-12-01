# sensor/urls.py
from django.urls import path

from .views import DMHomeView, DMSensorView, DMSensorListView, DMSensorTypesView, DMSensorTypeView

urlpatterns = [
    path('home/', DMHomeView.as_view(), name='dm_home'),
    path('sensor/<acp_id>/', DMSensorView.as_view(), name='dm_sensor'),
    path('sensor_list/', DMSensorListView.as_view(), name='dm_sensor_list'),
    path('sensor_types/', DMSensorTypesView.as_view(), name='dm_sensor_types'),
    path('sensor_type/<acp_type_id>/', DMSensorTypeView.as_view(), name='dm_sensor_type')
]
