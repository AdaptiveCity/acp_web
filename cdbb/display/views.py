# space/views.py
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.conf import settings
from django.http import JsonResponse
import requests

class HomeView(TemplateView):
    # Template "acp_web/cdbb/space/templates/space/home.html"
    template_name = 'display/home.html'

    def get(self, request, *args, **kwargs):
        display_id = self.kwargs['display_id']
        response = requests.get(settings.API_DISPLAYS+f'get/{display_id}/')
        return JsonResponse(response.json())

    # We override get_context_data to return the vars to embed in the template
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            return context
