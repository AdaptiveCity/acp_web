# Adaptive City Program Web System

## Overview
ACP Web provides the web access to the ACP Platform, supporting three main capabilities:
1. A visual display of data collected via ACP Server.
2. API's providing 3rd-party access to the collected data (both http/restful and zip download).
3. A highly flexible 'SmartPanel' system supporting web display of real-time content.

In the Adaptive City Platform architecture diagram below, `acp_web` is the "Web Host" shown bottom right:

![Platform Overview](cdbb/static/images/ACP_Architecture.png)

ACP Web provides the homepage, as below (as of 2020-07-24, during development):

![Home Page](cdbb/static/images/cdbb_homepage.png)

Currently the main functional aspects of the web content are to:

* Browse a *spatial* view of a region (i.e. map) and in-building information (typically floorplans) showing also the
installed sensors in that view, e.g.:

![Map View](cdbb/static/images/cdbb_space_view.png)

* View the *readings* for any sensor in a value/time plot, e.g. :

![Sensor data chart](cdbb/static/images/cdbb_sensor_chart.png)

* View the metadata for any sensor, providing relatively static information (compared to *readings*) for example the location of a fixed
sensor, its type.

* View the metadata for any *sensor type*, (e.g. a "RadioBridge IP67 Air Temperature and Humidity Sensor"), which will provide common
information for that type, including how to interpret the *readings*.

## Installation

This is a django application developed to be used with Python 3. To run the application follow these steps:

Install as user `acp_prod`, using a separate account for `sudo` access where necessary.

```
git clone https://github.com/AdaptiveCity/acp_web
cd acp_web
python3 -m venv venv
source venv/bin/activate
python3 -m pip install pip --upgrade
python3 -m pip install wheel
python3 -m pip install -r requirements.txt
```

Copy `~acp_prod/acp_web/secrets` directory from another server.

### Configure the database:
Install and configure postgreSQL database
```
sudo apt install postgresql postgresql-contrib postgis
```

Check the PostgreSQL database is running:
```
systemctl status postgresql
```

See [this guide to setting up PostgreSQL for Django](https://www.digitalocean.com/community/tutorials/how-to-use-postgresql-with-your-django-application-on-ubuntu-14-04)

Change to postgres user (created by the postgres install):
```
sudo su - postgres
```
Start the `psql` console:
```
psql
```
At the `psql` prompt, create database, user `acp_prod`
```
CREATE DATABASE acp_prod;
```
Create user `acp_prod` and permit to use database:
```
CREATE USER acp_prod WITH PASSWORD '<password>';
```
In the `acp_web/secrets/cdbb_settings.py` file ensure the DATABASES postgresql section
includes your chosen password:
```
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'acp_prod',
        'USER': 'acp_prod',
        'PASSWORD': '<password>',
        'HOST': '127.0.0.1',
        'PORT': '5432',
    }
}
```
Set up postgresql settings & permission the `acp_prod` user:
```
ALTER ROLE acp_prod SET client_encoding TO 'utf8';
ALTER ROLE acp_prod SET default_transaction_isolation TO 'read committed';
ALTER ROLE acp_prod SET timezone TO 'Europe/London';
GRANT ALL PRIVILEGES ON DATABASE acp_prod TO acp_prod;
```
As the `acp_prod` user you can now test PostgreSQL access with:
```
psql
```
(Ctrl-D to quit)

Now as a sudo user:
```
sudo cp ~acp_prod/acp_web/nginx/includes2/acp_web.conf /etc/nginx/includes2/
sudo nginx -t

```

```
sudo service nginx restart
```
As `acp_prod` user:
```
cd ~acp_prod/acp_web/cdbb
source ../venv/bin/activate
python3 manage.py makemigrations
```
This last command will typically say (at this stage) 'No changes detected'.
Now do the migrations that setup the initial tables:
```
python3 manage.py migrate
```
Create a superuser (you can use your own id, rather than 'acp_prod'). The password is
safely stored salted and hashed. Other superusers can easily be added if required later via
the simple Django `/admin/` web interface.
```
python3 manage.py createsuperuser
```

## Collect the static files

In the `~acp_prod/acp_web/cdbb` directory:
```
./manage.py collectstatic
```

## Run acp_web

Test run `acp_web` from the `~acp_prod/acp_web/cdbb` directory:
```
source ../venv/bin/activate
python3 manage.py runserver 0.0.0.0:8000
```
Test running acp_web by visiting (for example) `https://<servername>/space/map/`.

If there are problems, bypass nginx by visiting `http://<servername>:8000/space/map/`.

`acp_web` will generally be run via `~/acp_web/run.sh`.  Create a crontab entry to have this happen on a server restart:
```
crontab -e
```
add contents:
```
@reboot /home/acp_prod/acp_web/run.sh
```
