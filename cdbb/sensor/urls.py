# sensor/urls.py
from django.urls import path

from .views import ChartView, SelectView

urlpatterns = [
    path('chart/<acp_id>/', ChartView.as_view(), name='sensor_chart'),
    path('select/', SelectView.as_view(), name='sensor_select')
]
