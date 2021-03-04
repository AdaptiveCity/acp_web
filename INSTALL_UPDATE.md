# Installation & Update information

Note `acp_web` has a dependecy on [`acp_data_strategy`](https://github.com/AdaptiveCity/acp_data_strategy) which serves the
data API's for sensor and asset data held in the `acp_prod` database. For both `acp_web` and `acp_data_stategy` the
database can be initialized by taking a `pg_dump` of the `acp_prod` database from `cdbb.uk` and loading that on your
server. Alternatively the database instructions can be followed separately for `acp_web` and `acp_data_strategy`.

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

## Update notes for ijl20 `acp_web` update 2021-03-04

*Update `acp_data_strategy` first.*

This update adds the initial 'Data Management' card to the homepage, with support limited to Sensors (it is intended to
extend this to Sensor Types and BIM Crates). The change includes moving all the `acp_web` data API calls into the Python
`views.py` files, replacing the calls previously in the Javascript.

The Data Management `Edit` function requires the `acp_data_strategy` service is updated, so the Sensors API provides a
new `update` method. This `acp_data_strategy` update is non-breaking and it should be done *before* this `acp_web` update
and all the existing API support should be unaffected.

As user `acp_prod`:
```
cd ~acp_prod/acp_web
```
Edit `secrets/settings.py` to add the `data_management` app to `PROJECT_APPS`:
```
PROJECT_APPS = [
    ...,
    'data_management'
]
```
Stop the current `acp_web`:
```
cd ~acp_prod/acp_web
source venv/bin/activate
./status.sh
<kill the running manage.py>
```
Download the new version of `acp_web` and restart:
```
cd ~acp_prod/acp_web
git pull
python -m pip install -r requirements.txt
cd cdbb
./manage.py collectstatic ('yes' to confirm)
cd ~acp_prod/acp_web
./run.sh
```
