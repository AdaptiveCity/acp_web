#!/bin/bash
source venv/bin/activate
cd cdbb
nohup python3 manage.py runserver 0.0.0.0:8000 >cdbb.log 2>cdbb.err & disown

