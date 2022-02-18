# space/views.py
from builtins import print
import re
import this
from urllib import response
from django.http import HttpResponseRedirect
from django.shortcuts import redirect
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.conf import settings

import requests
import json
import sys

class HomeView(TemplateView):
    # Template "acp_web/cdbb/space/templates/space/home.html"
    template_name = 'space/home.html'

    def get(self, request, *args, **kwargs):
        person_id = str(request.user)
        object_id = '__'.join(request.path.split('/'))
        object_type = 'url'
        operation_type = 'read'

        request_url = settings.API_PERMISSIONS+f'get_permission/{person_id}/{object_id}/{object_type}/{operation_type}'
        
        access_response = requests.get(request_url)

        print(access_response.text)

        if not access_response.json()['permission']:
            return HttpResponseRedirect('/accounts/login/')
        return super().get(request, *args, **kwargs)

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            return context

class MapView(TemplateView):
    # Template "acp_web/cdbb/space/templates/space/map.html"
    template_name = 'space/map.html'

    def get(self, request, *args, **kwargs):
        person_id = str(request.user)
        object_id = '__'.join(request.path.split('/'))
        object_type = 'url'
        operation_type = 'read'

        request_url = settings.API_PERMISSIONS+f'get_permission/{person_id}/{object_id}/{object_type}/{operation_type}'
        
        access_response = requests.get(request_url)

        print(access_response.text)

        if not access_response.json()['permission']:
            return HttpResponseRedirect('/accounts/login/')
        return super().get(request, *args, **kwargs)

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

class BuildingView(TemplateView):
    # Template "acp_web/cdbb/space/templates/space/building.html"
    template_name = 'space/building.html'

    def get(self, request, *args, **kwargs):
        person_id = str(request.user)
        object_id = '__'.join(request.path.split('/'))
        object_type = 'url'
        operation_type = 'read'

        request_url = settings.API_PERMISSIONS+f'get_permission/{person_id}/{object_id}/{object_type}/{operation_type}'
        
        access_response = requests.get(request_url)

        print(access_response.text)

        if not access_response.json()['permission']:
            return HttpResponseRedirect('/accounts/login/')
        return super().get(request, *args, **kwargs)

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

class FloorView(TemplateView):
    # Template from "acp_web/cdbb/space/templates/space/"
    template_name = 'space/floor.html'

    def get(self, request, *args, **kwargs):
        person_id = str(request.user)
        object_id = '__'.join(request.path.split('/'))
        object_type = 'url'
        operation_type = 'read'

        request_url = settings.API_PERMISSIONS+f'get_permission/{person_id}/{object_id}/{object_type}/{operation_type}'
        
        access_response = requests.get(request_url)

        print(access_response.text)

        if not access_response.json()['permission']:
            return HttpResponseRedirect('/accounts/login/')
        return super().get(request, *args, **kwargs)

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
            response = requests.get(settings.API_SENSORS+f'get_floor_number/{system}/{floor_number}/?person_id='+str(self.request.user))
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

class FloorspaceView(TemplateView):
    # Template from "acp_web/cdbb/space/templates/space/"
    template_name = 'space/floorspace.html'

    def get(self, request, *args, **kwargs):
        person_id = str(request.user)
        object_id = '__'.join(request.path.split('/'))
        object_type = 'url'
        operation_type = 'read'

        request_url = settings.API_PERMISSIONS+f'get_permission/{person_id}/{object_id}/{object_type}/{operation_type}'
        
        access_response = requests.get(request_url)

        print(access_response.text)

        if not access_response.json()['permission']:
            return HttpResponseRedirect('/accounts/login/')
        return super().get(request, *args, **kwargs)

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
            response = requests.get(settings.API_SENSORS+f'get_floor_number/{system}/{floor_number}/?person_id='+str(self.request.user))
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

    def get(self, request, *args, **kwargs):
        person_id = str(request.user)
        object_id = '__'.join(request.path.split('/'))
        object_type = 'url'
        operation_type = 'read'

        request_url = settings.API_PERMISSIONS+f'get_permission/{person_id}/{object_id}/{object_type}/{operation_type}'
        
        access_response = requests.get(request_url)

        print(access_response.text)

        if not access_response.json()['permission']:
            return HttpResponseRedirect('/accounts/login/')
        return super().get(request, *args, **kwargs)

#Heatmap view aka Rain
class RainView(TemplateView):
    # Template from "acp_web/cdbb/space/templates/space/"
    template_name = 'space/floor_rain.html'

    def get(self, request, *args, **kwargs):
        person_id = str(request.user)
        object_id = '__'.join(request.path.split('/'))
        object_type = 'url'
        operation_type = 'read'

        request_url = settings.API_PERMISSIONS+f'get_permission/{person_id}/{object_id}/{object_type}/{operation_type}'
        
        access_response = requests.get(request_url)

        print(access_response.text)

        if not access_response.json()['permission']:
            return HttpResponseRedirect('/accounts/login/')
        return super().get(request, *args, **kwargs)

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

#Heatmap view aka Rain for a crate
class CrateRainView(TemplateView):
    # Template from "acp_web/cdbb/space/templates/space/"
    template_name = 'space/crate_rain.html'

    def get(self, request, *args, **kwargs):
        
        crate_id = kwargs['crate_id']

        person_id = str(request.user)
        object_id = crate_id
        object_type = 'crate'
        operation_type = 'read'

        request_url = settings.API_PERMISSIONS+f'get_permission/{person_id}/{object_id}/{object_type}/{operation_type}'
    
        access_response = requests.get(request_url)

        print('respose_text: ',access_response.text)

        if not access_response.json()['permission']:
            return HttpResponseRedirect('/accounts/login/')
        
        return super().get(request, *args, **kwargs)

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

class SplashHomeView(TemplateView):
    # Template "acp_web/cdbb/space/templates/space/splash_home.html"
    template_name = 'space/splash_home.html'

    def get(self, request, *args, **kwargs):
        person_id = str(request.user)
        object_id = '__'.join(request.path.split('/'))
        object_type = 'url'
        operation_type = 'read'

        request_url = settings.API_PERMISSIONS+f'get_permission/{person_id}/{object_id}/{object_type}/{operation_type}'
        
        access_response = requests.get(request_url)

        print(access_response.text)

        if not access_response.json()['permission']:
            return HttpResponseRedirect('/accounts/login/')
        return super().get(request, *args, **kwargs)

#Splash view aka draw ripples and check which sensors are (in)active
class SplashView(TemplateView):
    # Template from "acp_web/cdbb/space/templates/space/"
    template_name = 'space/floor_splash.html'

    def get(self, request, *args, **kwargs):
        person_id = str(request.user)
        object_id = '__'.join(request.path.split('/'))
        object_type = 'url'
        operation_type = 'read'

        request_url = settings.API_PERMISSIONS+f'get_permission/{person_id}/{object_id}/{object_type}/{operation_type}'
        
        access_response = requests.get(request_url)

        print(access_response.text)

        if not access_response.json()['permission']:
            return HttpResponseRedirect('/accounts/login/')
        return super().get(request, *args, **kwargs)

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
