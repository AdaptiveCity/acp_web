# space/views.py
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.conf import settings

class DMHomeView(TemplateView):
    template_name = 'data_management/home.html'

###############################################################
###############################################################
#             SENSORS                                         #
###############################################################
###############################################################

class DMSensorView(LoginRequiredMixin, TemplateView):
    template_name = 'data_management/sensor.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_BIM'] = settings.API_BIM
            context['API_SENSORS'] = settings.API_SENSORS
            context['ACP_ID'] = self.kwargs['acp_id']

            return context

class DMSensorEditView(LoginRequiredMixin, TemplateView):
    template_name = 'data_management/sensor_edit.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['API_BIM'] = settings.API_BIM
            context['API_SENSORS'] = settings.API_SENSORS
            context['ACP_ID'] = self.kwargs['acp_id']

            return context

class DMSensorHistoryView(LoginRequiredMixin, TemplateView):
    template_name = 'data_management/sensor_history.html'

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
