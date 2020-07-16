# sensor/urls.py
from django.urls import path

from .views import ChartView

urlpatterns = [
    path('chart/<acp_id>/', ChartView.as_view(), name='sensor_chart')
]

