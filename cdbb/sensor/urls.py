# sensor/urls.py
from django.urls import path

from .views import SensorHomeView, SensorView, SensorChartView,  \
    SensorListView, SensorResearchView, SensorTypesView, SensorTypeView

urlpatterns = [
    path('home/', SensorHomeView.as_view(), name='sensor_home'),
    path('sensor/<acp_id>/', SensorView.as_view(), name='sensor'),
    path('chart/<acp_id>/', SensorChartView.as_view(), name='sensor_chart'),
    path('list/', SensorListView.as_view(), name='sensor_list'),
    path('research/', SensorResearchView.as_view(), name='sensor_research'),
    path('types/', SensorTypesView.as_view(), name='sensor_types'),
    path('type/<acp_type_id>/', SensorTypeView.as_view(), name='sensor_type')
]
