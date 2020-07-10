from django.shortcuts import render

# Create your views here.
# pages/views.py
from django.http import HttpResponse

def homeView(request):
    return HttpResponse('Home hello world')

def mapView(request):
    return HttpResponse('Map Hello, World!')
