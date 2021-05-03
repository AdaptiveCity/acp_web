# space/views.py
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.conf import settings

import requests
import json
import sys

# Templates from "acp_web/cdbb/sensor/templates/sensor/"

class SensorHomeView(TemplateView):
    template_name = 'sensor/sensor_home.html'

class SensorResearchView(TemplateView):
    template_name = 'sensor/sensor_research.html'

class SensorChartView(LoginRequiredMixin, TemplateView):
    template_name = 'sensor/sensor_chart.html'

    # We override get_context_data to return the vars to embed in the template
    # Positional args are in self.args.
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['SENSOR_REALTIME'] = "not implemented"
            acp_id = self.kwargs['acp_id']
            context['ACP_ID'] = acp_id

            #DEBUG these API references will be removed
            context['API_READINGS'] = settings.API_READINGS

            # &date=YYYY-MM-DD
            selected_date = self.request.GET.get('date',None)
            if selected_date is not None:
                print("SensorChartView date in request '"+selected_date)
                if len(selected_date) == 10:
                    context['YYYY'] = selected_date[0:4]
                    context['MM'] = selected_date[5:7]
                    context['DD'] = selected_date[8:10]
            else:
                print("ChartView no date",kwargs)

            # &feature=temperature
            selected_feature = self.request.GET.get('feature',None)
            if selected_feature is not None:
                print("SensorChartView feature in request '"+selected_feature)
                context['FEATURE'] = selected_feature
            else:
                print("SensorChartView no feature",kwargs)

            # Readings
            query_string = '?metadata=true'
            if selected_date is not None:
                query_string += '&date='+selected_date
            response = requests.get(settings.API_READINGS+'get_day/'+acp_id+'/'+query_string)
            try:
                sensor_readings = response.json()
            except json.decoder.JSONDecodeError:
                context["SENSOR_READINGS"] = f'{{ "acp_error": "Sensor readings for {acp_id} unavailable" }}'
                return context

            context['SENSOR_READINGS'] = json.dumps(sensor_readings)

            return context


class SensorView(LoginRequiredMixin, TemplateView):
    template_name = 'sensor/sensor.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_SENSORS'] = settings.API_SENSORS
            acp_id = self.kwargs['acp_id']
            context['ACP_ID'] = acp_id

            response = requests.get(settings.API_SENSORS+'get/'+acp_id+'/')
            try:
                sensor_info = response.json()
            except json.decoder.JSONDecodeError:
                context["API_SENSORS_INFO"] = f'{{ "acp_error": "Sensor metadata for {acp_id} unavailable" }}'
                return context

            context['API_SENSORS_INFO'] = json.dumps(sensor_info)

            return context

class SensorTypeView(LoginRequiredMixin, TemplateView):
    template_name = 'sensor/sensor_type.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)

            acp_type_id = self.kwargs['acp_type_id']
            context['ACP_TYPE_ID'] = acp_type_id

            response = requests.get(settings.API_SENSORS+'get_type/'+acp_type_id+'/')
            try:
                sensor_info = response.json()
            except json.decoder.JSONDecodeError:
                context["API_SENSORS_INFO"] = f'{{ "acp_error": "Sensor metadata for {acp_type_id} unavailable" }}'
                return context

            context['API_SENSORS_INFO'] = json.dumps(sensor_info)

            return context

class SensorListView(LoginRequiredMixin, TemplateView):
    template_name = 'sensor/sensor_list.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_SENSORS'] = settings.API_SENSORS

            # e.g. &feature=temperature
            selected_feature = self.request.GET.get('feature',None)
            if selected_feature is not None:
                print("SensorListView feature in request '"+selected_feature)
                context['FEATURE'] = selected_feature
            else:
                print("SensorListView no feature",kwargs)

            response = requests.get(settings.API_SENSORS+'list/?type_metadata=true')
            try:
                sensor_info = response.json()
            except json.decoder.JSONDecodeError:
                context["API_SENSORS_INFO"] = f'{{ "acp_error": "Sensor metadata list API unavailable" }}'
                return context

            context['API_SENSORS_INFO'] = json.dumps(sensor_info)

            return context

class SensorTypesView(TemplateView):
    template_name = 'sensor/sensor_types.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_SENSORS'] = settings.API_SENSORS

            # e.g. &feature=temperature
            selected_feature = self.request.GET.get('feature',None)
            if selected_feature is not None:
                print("SensorTypesView feature in request '"+selected_feature)
                context['FEATURE'] = selected_feature
            else:
                print("SensorTypesView no feature",kwargs)

            response = requests.get(settings.API_SENSORS+'list_types/')
            try:
                sensor_info = response.json()
            except json.decoder.JSONDecodeError:
                context["API_SENSORS_INFO"] = f'{{ "acp_error": "Sensor metadata list API unavailable" }}'
                return context

            context['API_SENSORS_INFO'] = json.dumps(sensor_info)

            return context
