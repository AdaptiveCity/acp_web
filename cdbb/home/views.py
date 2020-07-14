# home/views.py
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin

class HomeView(TemplateView):
    template_name = 'home/home.html'

class AboutView(TemplateView):
    template_name = 'home/about.html'

class ResearchView(TemplateView):
    template_name = 'home/research.html'

class TimeView(TemplateView):
    template_name = 'home/time.html'

class AccountView(LoginRequiredMixin, TemplateView):
    template_name = 'home/account.html'
