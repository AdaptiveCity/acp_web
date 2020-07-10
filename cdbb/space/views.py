# space/views.py
from django.views.generic import TemplateView

class MapView(TemplateView):
    template_name = 'space/map.html'
