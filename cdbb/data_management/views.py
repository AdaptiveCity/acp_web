# space/views.py
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.conf import settings
import requests
import json

class DMHomeView(TemplateView):
    template_name = 'data_management/home.html'

###############################################################
###############################################################
#             SENSORS                                         #
###############################################################
###############################################################

class DMSensorView(LoginRequiredMixin, TemplateView):
    template_name = 'data_management/sensor.html'

    # We override get_context_data to return the vars to embed in the template
    # Positional args are in self.args.
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['SENSOR_REALTIME'] = settings.SENSOR_REALTIME
            context['ACP_ID'] = self.kwargs['acp_id']

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
            response = requests.get(settings.API_READINGS+'get_day/'+self.kwargs['acp_id']+'/'+query_string)
            sensor_readings = response.json()
            context['SENSOR_READINGS'] = json.dumps(sensor_readings)

            return context

class DMSensorMetadataView(LoginRequiredMixin, TemplateView):
    template_name = 'data_management/sensor_metadata.html'

    def get_context_data(self, **kwargs):
            response = requests.get(settings.API_SENSORS+'get/'+self.kwargs['acp_id']+'/')
            sensor_metadata = response.json()

            context = super().get_context_data(**kwargs)
            context['ACP_ID'] = self.kwargs['acp_id']
            context['SENSOR_METADATA'] = json.dumps(sensor_metadata)

            return context

class DMSensorHistoryView(LoginRequiredMixin, TemplateView):
    template_name = 'data_management/sensor_history.html'

    def get_context_data(self, **kwargs):
            response = requests.get(settings.API_SENSORS+'get_history/'+self.kwargs['acp_id']+'/')
            sensor_history_obj = response.json()

            context = super().get_context_data(**kwargs)
            context['ACP_ID'] = self.kwargs['acp_id']
            context['API_SENSOR_INFO'] = json.dumps(sensor_history_obj['sensor_info'])
            context['API_SENSOR_HISTORY'] = json.dumps(sensor_history_obj['sensor_history'])
            context['ACP_TYPE_INFO'] = json.dumps(sensor_history_obj['acp_type_info'])
            return context

class DMSensorLocationView(LoginRequiredMixin, TemplateView):
    template_name = 'data_management/sensor_location.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_BIM'] = settings.API_BIM
            context['API_SENSORS'] = settings.API_SENSORS
            context['API_READINGS'] = settings.API_READINGS
            context['API_SPACE'] = settings.API_SPACE
            context['ACP_ID'] = self.kwargs['acp_id']
            context['CRATE_ID'] = 'FE11' #DEBUG derive CRATE_ID from sensor

            return context

class DMSensorEditView(LoginRequiredMixin, TemplateView):
    template_name = 'data_management/sensor_edit.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_BIM'] = settings.API_BIM
            context['API_SENSORS'] = settings.API_SENSORS
            context['ACP_ID'] = self.kwargs['acp_id']

            return context

class DMSensorListView(LoginRequiredMixin, TemplateView):
    template_name = 'data_management/sensor_list.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_SENSORS'] = settings.API_SENSORS

            # e.g. &feature=temperature
            selected_feature = self.request.GET.get('feature',None)
            if selected_feature is not None:
                print("DMSensorListView feature in request '"+selected_feature)
                context['FEATURE'] = selected_feature
            else:
                print("DMSensorListView no feature",kwargs)

            return context

###############################################################
###############################################################
#             SENSOR TYPES                                    #
###############################################################
###############################################################

class DMSensorTypeView(LoginRequiredMixin, TemplateView):
    template_name = 'data_management/sensor_type.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_BIM'] = settings.API_BIM
            context['API_SENSORS'] = settings.API_SENSORS
            context['ACP_TYPE_ID'] = self.kwargs['acp_type_id']

            return context

class DMSensorTypeHistoryView(LoginRequiredMixin, TemplateView):
    template_name = 'data_management/sensor_type_history.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_BIM'] = settings.API_BIM
            context['API_SENSORS'] = settings.API_SENSORS
            context['ACP_TYPE_ID'] = self.kwargs['acp_type_id']

            return context

class DMSensorTypeEditView(LoginRequiredMixin, TemplateView):
    template_name = 'data_management/sensor_type_edit.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_BIM'] = settings.API_BIM
            context['API_SENSORS'] = settings.API_SENSORS
            context['ACP_TYPE_ID'] = self.kwargs['acp_type_id']

            return context

class DMSensorTypesView(TemplateView):
    template_name = 'data_management/sensor_types.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_SENSORS'] = settings.API_SENSORS

            # e.g. &feature=temperature
            selected_feature = self.request.GET.get('feature',None)
            if selected_feature is not None:
                print("DMSensorTypesView feature in request '"+selected_feature)
                context['FEATURE'] = selected_feature
            else:
                print("DMSensorTypesView no feature",kwargs)

            return context
