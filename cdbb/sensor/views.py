# space/views.py
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.conf import settings

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
            context['API_BIM'] = settings.API_BIM
            context['API_SENSORS'] = settings.API_SENSORS
            context['API_READINGS'] = settings.API_READINGS
            context['API_SPACE'] = settings.API_SPACE
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

            return context

class SensorSelectView(LoginRequiredMixin, TemplateView):
    template_name = 'sensor/select.html'

class SensorView(LoginRequiredMixin, TemplateView):
    template_name = 'sensor/sensor.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_BIM'] = settings.API_BIM
            context['API_SENSORS'] = settings.API_SENSORS
            context['ACP_ID'] = self.kwargs['acp_id']

            return context

class SensorTypeView(LoginRequiredMixin, TemplateView):
    template_name = 'sensor/sensor_type.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_BIM'] = settings.API_BIM
            context['API_SENSORS'] = settings.API_SENSORS
            context['ACP_TYPE_ID'] = self.kwargs['acp_type_id']

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

            return context
