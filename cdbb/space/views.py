# space/views.py
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.conf import settings

import requests
import json
import sys

class HomeView(TemplateView):
    # Template "acp_web/cdbb/space/templates/space/home.html"
    template_name = 'space/home.html'

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            return context

class MapView(TemplateView):
    # Template "acp_web/cdbb/space/templates/space/map.html"
    template_name = 'space/map.html'

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)

            # Get the crate (building) metadata from the BIM API
            crate_ids = settings.CRATE_IDS.split(',')
            bim_api_responses = {}
            for crate_id in crate_ids:
                response = requests.get(settings.API_BIM+"get_gps/"+crate_id+"/0/")

                try:
                    bim_api_responses[crate_id] = response.json()[crate_id]
                except json.decoder.JSONDecodeError:
                    context["API_BIM_INFO"] = f'{{ "acp_error": "BIM API crate info for {crate_id} unavailable" }}'
                    return

            context["API_BIM_INFO"] = json.dumps(bim_api_responses)


            # Get the sensor metadata for all sensors with GPS locations
            response = requests.get(settings.API_SENSORS + 'get_gps/')
            try:
                sensor_info = response.json()
                context["API_SENSOR_INFO"] = json.dumps(sensor_info)
            except json.decoder.JSONDecodeError:
                context["API_SENSOR_INFO"] = '{ "acp_error": "SENSORS API get_gps/ failed" }'

            return context

class BuildingView(LoginRequiredMixin, TemplateView):
    # Template "acp_web/cdbb/space/templates/space/building.html"
    template_name = 'space/building.html'

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)

            crate_id = self.kwargs['crate_id']
            context['CRATE_ID'] = crate_id

            # Get building floors SVG
            response = requests.get(settings.API_SPACE+f'get_bim_json/{crate_id}/1/')
            space_info = response.json()

            context['API_SPACE_INFO'] = json.dumps(space_info)

            return context

class FloorView(LoginRequiredMixin, TemplateView):
    # Template from "acp_web/cdbb/space/templates/space/"
    template_name = 'space/floor.html'

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)

            crate_id = self.kwargs['crate_id']

            # Get crate floor_number and system
            response = requests.get(settings.API_BIM+f'get/{crate_id}/0/')
            bim_info = response.json()

            floor_number = bim_info[crate_id]["acp_location"]["f"]; #DEBUG this should be acp_location_xyzf
            system = bim_info[crate_id]["acp_location"]["system"]

            # Get metadata for all sensors in the same crate (including selected sensor)
            response = requests.get(settings.API_SENSORS+f'get_floor_number/{system}/{floor_number}/')
            sensors_info = response.json()

            # Get floor SVG
            response = requests.get(settings.API_SPACE+f'get_floor_number_json/{system}/{floor_number}/')
            space_info = response.json()

            context['CRATE_ID'] = crate_id
            context['API_BIM_INFO'] = json.dumps(bim_info)
            context['API_SENSORS_INFO'] = json.dumps(sensors_info)
            context['API_SPACE_INFO'] = json.dumps(space_info)
            context['FLOOR_NUMBER'] = floor_number
            context['COORDINATE_SYSTEM'] = system

            return context

class FloorspaceView(LoginRequiredMixin, TemplateView):
    # Template from "acp_web/cdbb/space/templates/space/"
    template_name = 'space/floorspace.html'

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)

            crate_id = self.kwargs['crate_id']

            # Get crate floor_number and system
            response = requests.get(settings.API_BIM+f'get/{crate_id}/0/')
            bim_info = response.json()

            floor_number = bim_info[crate_id]["acp_location"]["f"]; #DEBUG this should be acp_location_xyzf
            system = bim_info[crate_id]["acp_location"]["system"]

            # Get metadata for all sensors in the same crate (including selected sensor)
            response = requests.get(settings.API_SENSORS+f'get_floor_number/{system}/{floor_number}/')
            sensors_info = response.json()

            # Get floor SVG
            response = requests.get(settings.API_SPACE+f'get_floor_number_json/{system}/{floor_number}/')
            space_info = response.json()

            context['CRATE_ID'] = crate_id
            context['API_BIM_INFO'] = json.dumps(bim_info)
            context['API_SENSORS_INFO'] = json.dumps(sensors_info)
            context['API_SPACE_INFO'] = json.dumps(space_info)

            return context

class RainHomeView(TemplateView):
    # Template "acp_web/cdbb/space/templates/space/rain_home.html"
    template_name = 'space/rain_home.html'

#Heatmap view aka Rain
class RainView(LoginRequiredMixin, TemplateView):
    # Template from "acp_web/cdbb/space/templates/space/"
    template_name = 'space/floor_rain.html'

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)

            crate_id = self.kwargs['crate_id']

            # Get crate floor_number and system
            response = requests.get(settings.API_BIM+f'get/{crate_id}/0/')
            bim_info = response.json()

            floor_number = bim_info[crate_id]["acp_location"]["f"]; #DEBUG this should be acp_location_xyzf
            system = bim_info[crate_id]["acp_location"]["system"]

            # Get metadata for all sensors in the same crate (including selected sensor)
            response = requests.get(settings.API_SENSORS+f'get_floor_number/{system}/{floor_number}/')
            sensors_info = response.json()

            # Get floor SVG
            response = requests.get(settings.API_SPACE+f'get_floor_number_json/{system}/{floor_number}/')
            space_info = response.json()

            # Get feature readings
            feature = self.request.GET.get('feature')
            if not feature:
                feature = 'temperature'
            response = requests.get(settings.API_READINGS+f'get_floor_feature/{system}/{floor_number}/{feature}/?metadata=true')
            readings_info = response.json()

            context['CRATE_ID'] = crate_id
            context['API_BIM_INFO'] = json.dumps(bim_info)
            context['API_SENSORS_INFO'] = json.dumps(sensors_info)
            context['API_SPACE_INFO'] = json.dumps(space_info)
            context['API_READINGS_INFO'] = json.dumps(readings_info)
            context['FLOOR_NUMBER'] = floor_number
            context['COORDINATE_SYSTEM'] = system

            context['RTMONITOR_URI'] = settings.RTMONITOR_BASE+'rtmonitor/A/mqtt_acp'
            return context

#Heatmap view aka Rain
class RotasOGView(LoginRequiredMixin, TemplateView):
    # Template from "acp_web/cdbb/space/templates/space/"
    template_name = 'space/rotas_og.html'

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)

            crate_id = self.kwargs['crate_id']

            # Get crate floor_number and system
            response = requests.get(settings.API_BIM+f'get/{crate_id}/0/')
            bim_info = response.json()

            floor_number = bim_info[crate_id]["acp_location"]["f"]; #DEBUG this should be acp_location_xyzf
            system = bim_info[crate_id]["acp_location"]["system"]

            # Get metadata for all sensors in the same crate (including selected sensor)
            response = requests.get(settings.API_SENSORS+f'get_floor_number/{system}/{floor_number}/')
            sensors_info = response.json()

            # Get floor SVG
            response = requests.get(settings.API_SPACE+f'get_floor_number_json/{system}/{floor_number}/')
            space_info = response.json()

            # Get feature readings
            feature = self.request.GET.get('feature')
            if not feature:
                feature = 'co2'
            response = requests.get(settings.API_READINGS+f'get_floor_feature/{system}/{floor_number}/{feature}/?metadata=true')
            readings_info = response.json()

            context['CRATE_ID'] = crate_id
            context['API_BIM_INFO'] = json.dumps(bim_info)
            context['API_SENSORS_INFO'] = json.dumps(sensors_info)
            context['API_SPACE_INFO'] = json.dumps(space_info)
            context['API_READINGS_INFO'] = json.dumps(readings_info)
            context['FLOOR_NUMBER'] = floor_number
            context['COORDINATE_SYSTEM'] = system

            context['RTMONITOR_URI'] = settings.RTMONITOR_BASE+'rtmonitor/A/mqtt_acp'
            return context


#Heatmap view aka Rain
class RotasView(LoginRequiredMixin, TemplateView):
    # Template from "acp_web/cdbb/space/templates/space/"
    template_name = 'space/rotas.html'

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)

            crate_id = self.kwargs['crate_id']

            # Get crate floor_number and system
            response = requests.get(settings.API_BIM+f'get/{crate_id}/0/')
            bim_info = response.json()

            floor_number = bim_info[crate_id]["acp_location"]["f"]; #DEBUG this should be acp_location_xyzf
            system = bim_info[crate_id]["acp_location"]["system"]

            # Get metadata for all sensors in the same crate (including selected sensor)
            response = requests.get(settings.API_SENSORS+f'get_floor_number/{system}/{floor_number}/')
            sensors_info = response.json()

            # Get floor SVG
            response = requests.get(settings.API_SPACE+f'get_floor_number_json/{system}/{floor_number}/')
            space_info = response.json()

            # Get feature readings
            feature = self.request.GET.get('feature')
            if not feature:
                feature = 'co2'
            response = requests.get(settings.API_READINGS+f'get_floor_feature/{system}/{floor_number}/{feature}/?metadata=true')
            readings_info = response.json()

            context['CRATE_ID'] = crate_id
            context['API_BIM_INFO'] = json.dumps(bim_info)
            context['API_SENSORS_INFO'] = json.dumps(sensors_info)
            context['API_SPACE_INFO'] = json.dumps(space_info)
            context['API_READINGS_INFO'] = json.dumps(readings_info)
            context['FLOOR_NUMBER'] = floor_number
            context['COORDINATE_SYSTEM'] = system

            context['RTMONITOR_URI'] = settings.RTMONITOR_BASE+'rtmonitor/A/mqtt_acp'
            return context


#Heatmap view aka Rain
class RotasROCView(LoginRequiredMixin, TemplateView):
    # Template from "acp_web/cdbb/space/templates/space/"
    template_name = 'space/rotas_roc.html'

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)

            crate_id = self.kwargs['crate_id']

            # Get crate floor_number and system
            response = requests.get(settings.API_BIM+f'get/{crate_id}/0/')
            bim_info = response.json()

            floor_number = bim_info[crate_id]["acp_location"]["f"]; #DEBUG this should be acp_location_xyzf
            system = bim_info[crate_id]["acp_location"]["system"]

            # Get metadata for all sensors in the same crate (including selected sensor)
            response = requests.get(settings.API_SENSORS+f'get_floor_number/{system}/{floor_number}/')
            sensors_info = response.json()

            # Get floor SVG
            response = requests.get(settings.API_SPACE+f'get_floor_number_json/{system}/{floor_number}/')
            space_info = response.json()

            # Get feature readings
            feature = self.request.GET.get('feature')
            if not feature:
                feature = 'co2'
            response = requests.get(settings.API_READINGS+f'get_floor_feature/{system}/{floor_number}/{feature}/?metadata=true')
            readings_info = response.json()

            context['CRATE_ID'] = crate_id
            context['API_BIM_INFO'] = json.dumps(bim_info)
            context['API_SENSORS_INFO'] = json.dumps(sensors_info)
            context['API_SPACE_INFO'] = json.dumps(space_info)
            context['API_READINGS_INFO'] = json.dumps(readings_info)
            context['FLOOR_NUMBER'] = floor_number
            context['COORDINATE_SYSTEM'] = system

            context['RTMONITOR_URI'] = settings.RTMONITOR_BASE+'rtmonitor/A/mqtt_acp'
            return context



#Heatmap view aka Rain
class Rotas2000(LoginRequiredMixin, TemplateView):
    # Template from "acp_web/cdbb/space/templates/space/"
    template_name = 'space/rotas2000.html'

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)

            crate_id = self.kwargs['crate_id']

            # Get crate floor_number and system
            response = requests.get(settings.API_BIM+f'get/{crate_id}/0/')
            bim_info = response.json()

            floor_number = bim_info[crate_id]["acp_location"]["f"]; #DEBUG this should be acp_location_xyzf
            system = bim_info[crate_id]["acp_location"]["system"]

            # Get metadata for all sensors in the same crate (including selected sensor)
            response = requests.get(settings.API_SENSORS+f'get_floor_number/{system}/{floor_number}/')
            sensors_info = response.json()

            # Get floor SVG
            response = requests.get(settings.API_SPACE+f'get_floor_number_json/{system}/{floor_number}/')
            space_info = response.json()

            # Get feature readings
            feature = self.request.GET.get('feature')          
            if not feature:
                feature = 'co2'

            # Get feature readings
            date = self.request.GET.get('date')          
            if not date:
                date = ''
                response = requests.get(settings.API_READINGS+f'get_floor_feature/{system}/{floor_number}/{feature}/')
            else:
                response = requests.get(settings.API_READINGS+f'get_floor_feature/{system}/{floor_number}/{feature}/'+'?metadata=true&date='+date)

            readings_info = response.json()

            context['CRATE_ID'] = crate_id
            context['API_BIM_INFO'] = json.dumps(bim_info)
            context['API_SENSORS_INFO'] = json.dumps(sensors_info)
            context['API_SPACE_INFO'] = json.dumps(space_info)
            context['API_READINGS_INFO'] = json.dumps(readings_info)
            context['FLOOR_NUMBER'] = floor_number
            context['COORDINATE_SYSTEM'] = system

            context['RTMONITOR_URI'] = settings.RTMONITOR_BASE+'rtmonitor/A/mqtt_acp'
            return context


class SplashHomeView(TemplateView):
    # Template "acp_web/cdbb/space/templates/space/splash_home.html"
    template_name = 'space/splash_home.html'

#Splash view aka draw ripples and check which sensors are (in)active
class SplashView(LoginRequiredMixin, TemplateView):
    # Template from "acp_web/cdbb/space/templates/space/"
    template_name = 'space/floor_splash.html'

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)

            crate_id = self.kwargs['crate_id']

            # Get crate floor_number and system
            response = requests.get(settings.API_BIM+f'get/{crate_id}/0/')
            bim_info = response.json()

            floor_number = bim_info[crate_id]["acp_location"]["f"]; #DEBUG this should be acp_location_xyzf
            system = bim_info[crate_id]["acp_location"]["system"]

            # Get metadata for all sensors in the same crate (including selected sensor)
            response = requests.get(settings.API_SENSORS+f'get_floor_number/{system}/{floor_number}/')
            sensors_info = response.json()

            # Get floor SVG
            response = requests.get(settings.API_SPACE+f'get_floor_number_json/{system}/{floor_number}/')
            space_info = response.json()

            context['CRATE_ID'] = crate_id
            context['API_BIM_INFO'] = json.dumps(bim_info)
            context['API_SENSORS_INFO'] = json.dumps(sensors_info)
            context['API_SPACE_INFO'] = json.dumps(space_info)
            context['FLOOR_NUMBER'] = floor_number
            context['COORDINATE_SYSTEM'] = system

            context['RTMONITOR_URI'] = settings.RTMONITOR_BASE+'rtmonitor/A/mqtt_acp'
            return context
