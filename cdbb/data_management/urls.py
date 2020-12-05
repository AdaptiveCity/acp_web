# data_management/urls.py
from django.urls import path

from .views import DMHomeView
from .views import DMSensorListView, DMSensorView, DMSensorLocationView, DMSensorMetadataView, DMSensorEditView, DMSensorHistoryView
from .views import DMSensorTypeView, DMSensorTypesView, DMSensorTypeEditView, DMSensorTypeHistoryView

urlpatterns = [
    path('home/', DMHomeView.as_view(), name='dm_home'),

    path('sensor/<acp_id>/', DMSensorView.as_view(), name='dm_sensor'),
    path('sensor_location/<acp_id>/', DMSensorLocationView.as_view(), name='dm_sensor_location'),
    path('sensor_metadata/<acp_id>/', DMSensorMetadataView.as_view(), name='dm_sensor_metadata'),
    path('sensor_history/<acp_id>/', DMSensorHistoryView.as_view(), name='dm_sensor_history'),
    path('sensor_edit/<acp_id>/', DMSensorEditView.as_view(), name='dm_sensor_edit'),
    path('sensors/', DMSensorListView.as_view(), name='dm_sensors'),

    path('sensor_type/<acp_type_id>/', DMSensorTypeView.as_view(), name='dm_sensor_type'),
    path('sensor_type_edit/<acp_type_id>/', DMSensorTypeEditView.as_view(), name='dm_sensor_type_edit'),
    path('sensor_type_history/<acp_type_id>/', DMSensorTypeHistoryView.as_view(), name='dm_sensor_type_history'),
    path('sensor_types/', DMSensorTypesView.as_view(), name='dm_sensor_types')
]
