# space/views.py
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.conf import settings

class MapView(TemplateView):
    # Template "acp_web/cdbb/space/templates/space/map.html"
    template_name = 'space/map.html'

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_BIM'] = settings.API_BIM
            context['API_SENSORS'] = settings.API_SENSORS
            context['CRATE_IDS'] = settings.CRATE_IDS
            return context

class BuildingView(LoginRequiredMixin, TemplateView):
    # Template "acp_web/cdbb/space/templates/space/building.html"
    template_name = 'space/building.html'

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_BIM'] = settings.API_BIM
            context['API_SENSORS'] = settings.API_SENSORS
            context['API_READINGS'] = settings.API_READINGS
            context['API_SPACE'] = settings.API_SPACE
            context['CRATE_IDS'] = settings.CRATE_IDS
            context['CRATE_ID'] = self.kwargs['crate_id']
            return context

class FloorView(LoginRequiredMixin, TemplateView):
    # Template from "acp_web/cdbb/space/templates/space/"
    template_name = 'space/floor.html'

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_BIM'] = settings.API_BIM
            context['API_SENSORS'] = settings.API_SENSORS
            context['API_READINGS'] = settings.API_READINGS
            context['API_SPACE'] = settings.API_SPACE
            context['CRATE_IDS'] = settings.CRATE_IDS
            context['CRATE_ID'] = self.kwargs['crate_id']
            return context

class FloorspaceView(LoginRequiredMixin, TemplateView):
    # Template from "acp_web/cdbb/space/templates/space/"
    template_name = 'space/floorspace.html'

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_BIM'] = settings.API_BIM
            context['API_SENSORS'] = settings.API_SENSORS
            context['API_READINGS'] = settings.API_READINGS
            context['API_SPACE'] = settings.API_SPACE
            context['CRATE_IDS'] = settings.CRATE_IDS
            context['CRATE_ID'] = self.kwargs['crate_id']
            return context
            
#Heatmap view aka Rain
class RainView(LoginRequiredMixin, TemplateView):
    # Template from "acp_web/cdbb/space/templates/space/"
    template_name = 'space/floor_rain.html'

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_BIM'] = settings.API_BIM
            context['API_SENSORS'] = settings.API_SENSORS
            context['API_READINGS'] = settings.API_READINGS
            context['API_SPACE'] = settings.API_SPACE
            context['CRATE_IDS'] = settings.CRATE_IDS
            context['CRATE_ID'] = self.kwargs['crate_id']
            return context