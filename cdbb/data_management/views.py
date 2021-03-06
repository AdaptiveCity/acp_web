# space/views.py
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.conf import settings
from django.shortcuts import redirect
import requests
import json
import sys

class DMHomeView(TemplateView):
    template_name = 'data_management/home.html'

###############################################################
###############################################################
#             SENSORS                                         #
###############################################################
###############################################################

class DMSensorView(LoginRequiredMixin, TemplateView):
    template_name = 'data_management/sensor_readings.html'

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
            try:
                sensor_readings = response.json()
            except json.decoder.JSONDecodeError:
                context["SENSOR_READINGS"] = '{ "acp_error": "Sensor readings unavailable" }'
                return context
                
            context['SENSOR_READINGS'] = json.dumps(sensor_readings)

            return context

class DMSensorMetadataView(LoginRequiredMixin, TemplateView):
    template_name = 'data_management/sensor_metadata.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['ACP_ID'] = self.kwargs['acp_id']

            response = requests.get(settings.API_SENSORS+'get/'+self.kwargs['acp_id']+'/')
            try:
                sensor_metadata = response.json()
            except json.decoder.JSONDecodeError:
                    context["SENSOR_METADATA"] = '{ "acp_error": "Sensor metadata unavailable" }'
                    return context

            context['SENSOR_METADATA'] = json.dumps(sensor_metadata)

            return context

class DMSensorHistoryView(LoginRequiredMixin, TemplateView):
    template_name = 'data_management/sensor_history.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['ACP_ID'] = self.kwargs['acp_id']
            response = requests.get(settings.API_SENSORS+'get_history/'+self.kwargs['acp_id']+'/')
            try:
                sensor_history_obj = response.json()
            except json.decoder.JSONDecodeError:
                context["API_SENSOR_INFO"] = '{ "acp_error": "Sensor history unavailable" }'
                context['API_SENSOR_HISTORY'] = '[]'
                context['ACP_TYPE_INFO'] = '{}'
                return context

            if 'sensor_info' in sensor_history_obj:
                context['API_SENSOR_INFO'] = json.dumps(sensor_history_obj['sensor_info'])
            if 'sensor_history' in sensor_history_obj:
                context['API_SENSOR_HISTORY'] = json.dumps(sensor_history_obj['sensor_history'])
            if 'acp_type_info' in sensor_history_obj:
                context['ACP_TYPE_INFO'] = json.dumps(sensor_history_obj['acp_type_info'])
            return context

class DMSensorLocationView(LoginRequiredMixin, TemplateView):

    template_name = 'data_management/sensor_location.html'

    def get_context_data(self, **kwargs):
            acp_id = self.kwargs['acp_id']
            context = super().get_context_data(**kwargs)
            context['ACP_ID'] = acp_id

            # Get crate_id from the metadata for the selected sensor
            response = requests.get(settings.API_SENSORS+'get/'+acp_id+'/')
            try:
                sensor_info = response.json()
            except json.decoder.JSONDecodeError:
                context["API_SENSORS_INFO"] = '{ "acp_error": "Sensor metadata unavailable" }'
                return context

            if "crate_id" in sensor_info:
                crate_id = sensor_info["crate_id"]

                # Get crate floor_number and system
                response = requests.get(settings.API_BIM+f'get_xyzf/{crate_id}/0/')
                bim_info = response.json()

                floor_number = bim_info[crate_id]["acp_location_xyz"]["f"];
                system = bim_info[crate_id]["acp_location"]["system"]

                # Get metadata for all sensors in the same crate (including selected sensor)
                response = requests.get(settings.API_SENSORS+f'get_bim/{system}/{crate_id}/')
                sensors_info = response.json()

                # Get floor SVG
                response = requests.get(settings.API_SPACE+f'get_floor_number_json/{system}/{floor_number}/')
                space_info = response.json()

                # Get sensor READING
                response = requests.get(settings.API_READINGS+'get/'+self.kwargs['acp_id']+'/')
                readings_info = response.json()

                context['CRATE_ID'] = crate_id
                context['API_BIM_INFO'] = json.dumps(bim_info)
                context['API_SENSORS_INFO'] = json.dumps(sensors_info)
                context['API_READINGS_INFO'] = json.dumps(readings_info)
                context['API_SPACE_INFO'] = json.dumps(space_info)
            else:
                # No crate_id, so pass limited info to template
                sensors_info = {}
                sensors_info[acp_id] = sensor_info
                context['API_SENSORS_INFO'] = json.dumps(sensors_info)

            return context

class DMSensorEditView(LoginRequiredMixin, TemplateView):
    template_name = 'data_management/sensor_edit.html'

    def post(self, request, acp_id):
            sensor_metadata_str = request.POST.get('plain_text_value','{ "msg": "get failed" }')
            try:
                sensor_metadata_obj = json.loads(sensor_metadata_str)
            except json.decoder.JSONDecodeError:
                print(f'sensor_edit non-json in plain_text_value',file=sys.stderr)
                #DEBUG can return sensor_edit error message here
                return redirect('dm_sensor_edit',acp_id=acp_id)

            res = requests.post(settings.API_SENSORS+'update/'+self.kwargs['acp_id']+'/',
                                json=sensor_metadata_obj)
            if res.ok:
                print(f'sensor_edit wrote data to update',file=sys.stderr)
                return redirect('dm_sensor_history',acp_id=acp_id)
            else:
                print(f'sensor_edit bad response from api/sensors/update',file=sys.stderr)
                #DEBUG will return to edit page here
            return redirect('dm_sensor_history',acp_id=acp_id)

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['ACP_ID'] = self.kwargs['acp_id']
            response = requests.get(settings.API_SENSORS+'get/'+self.kwargs['acp_id']+'/')
            try:
                sensor_metadata = response.json()
            except json.decoder.JSONDecodeError:
                context["SENSOR_METADATA"] = '{ "acp_error": "Sensor metadata unavailable" }'
                return context

            context['SENSOR_METADATA'] = json.dumps(sensor_metadata)

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
