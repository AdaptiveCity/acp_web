# sensor/urls.py
from django.urls import path

from .views import SensorHomeView, SensorView, SensorChartView, SensorSelectView, \
    SensorListView, SensorResearchView, SensorTypesView

urlpatterns = [
    path('home/', SensorHomeView.as_view(), name='sensor_home'),
    path('sensor/<acp_id>/', SensorView.as_view(), name='sensor'),
    path('chart/<acp_id>/', SensorChartView.as_view(), name='sensor_chart'),
    path('select/', SensorSelectView.as_view(), name='sensor_select'),
    path('list/', SensorListView.as_view(), name='sensor_list'),
    path('research/', SensorResearchView.as_view(), name='sensor_research'),
    path('types/', SensorTypesView.as_view(), name='sensor_types')
]
