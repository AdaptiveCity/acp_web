# space/views.py
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.conf import settings

# Templates from "acp_web/cdbb/sensor/templates/sensor/"

class ChartView(LoginRequiredMixin, TemplateView):
    template_name = 'sensor/chart.html'

    # We override get_context_data to return the vars to embed in the template
    # Positional args are in self.args.
    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_BIM'] = settings.API_BIM
            context['API_SENSORS'] = settings.API_SENSORS
            context['API_READINGS'] = settings.API_READINGS
            context['API_SPACE'] = settings.API_SPACE
            context['SENSOR_REALTIME'] = settings.SENSOR_REALTIME
            context['ACP_ID'] = self.kwargs['acp_id']
            selected_date = self.request.GET.get('date',None)
            if selected_date is not None:
                print("ChartView date in request '"+selected_date+"' "+str(len(selected_date)))
                if len(selected_date) == 10:
                    context['YYYY'] = selected_date[0:4]
                    context['MM'] = selected_date[5:7]
                    context['DD'] = selected_date[8:10]
            else:
                print("ChartView no date",kwargs)
            return context

class SelectView(LoginRequiredMixin, TemplateView):
    template_name = 'sensor/select.html'
