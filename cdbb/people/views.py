# space/views.py
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.conf import settings
from django.shortcuts import redirect
import requests
import json
import sys

class PeopleHomeView(TemplateView):
    template_name = 'people/home.html'

###############################################################
###############################################################
#             PEOPLE                                         #
###############################################################
###############################################################

class PeoplePersonView(LoginRequiredMixin, TemplateView):
    template_name = 'people/person/person.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['PERSON_ID'] = self.kwargs['person_id']

            response = requests.get(settings.API_PEOPLE+'get/'+self.kwargs['person_id']+'/')
            try:
                person_metadata = response.json()
            except json.decoder.JSONDecodeError:
                    context["PERSON_METADATA"] = '{ "acp_error": "Person metadata unavailable" }'
                    return context

            context['PERSON_METADATA'] = json.dumps(person_metadata)

            return context

class PeoplePersonMetadataView(LoginRequiredMixin, TemplateView):
    template_name = 'people/person/person_metadata.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['PERSON_ID'] = self.kwargs['person_id']

            response = requests.get(settings.API_PEOPLE+'get/'+self.kwargs['person_id']+'/')
            try:
                person_metadata = response.json()
            except json.decoder.JSONDecodeError:
                    context["PERSON_METADATA"] = '{ "acp_error": "Person metadata unavailable" }'
                    return context

            context['PERSON_METADATA'] = json.dumps(person_metadata)

            return context

class PeoplePersonHistoryView(LoginRequiredMixin, TemplateView):
    template_name = 'people/person/person_history.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            context['PERSON_ID'] = self.kwargs['person_id']
            response = requests.get(settings.API_PEOPLE+'get_history/'+self.kwargs['person_id']+'/')
            try:
                person_history_obj = response.json()
            except json.decoder.JSONDecodeError:
                context["API_PERSON_INFO"] = '{ "acp_error": "Person history unavailable" }'
                context['API_PERSON_HISTORY'] = '[]'
                return context

            if 'person_info' in person_history_obj:
                context['API_PERSON_INFO'] = json.dumps(person_history_obj['person_info'])
            if 'person_history' in person_history_obj:
                context['API_PERSON_HISTORY'] = json.dumps(person_history_obj['person_history'])
            return context

class PeoplePersonLocationView(LoginRequiredMixin, TemplateView):

    template_name = 'people/person/person_location.html'

    def get_context_data(self, **kwargs):
        person_id = self.kwargs['person_id']
        context = super().get_context_data(**kwargs)
        context['PERSON_ID'] = person_id

        # Get crate_id from the metadata for the selected person
        response = requests.get(settings.API_PEOPLE+'get/'+person_id+'/')
        try:
            person_info = response.json()
        except json.decoder.JSONDecodeError:
            context["API_PEOPLE_INFO"] = '{ "acp_error": "Person metadata unavailable" }'
            return context

        if "crate_id" in person_info:
            crate_id = person_info["crate_id"]

            # Get crate floor_number and system
            response = requests.get(settings.API_BIM+f'get_xyzf/{crate_id}/0/')
            bim_info = response.json()

            floor_number = bim_info[crate_id]["acp_location_xyz"]["f"];
            system = bim_info[crate_id]["acp_location"]["system"]

            # Get metadata for all people in the same crate (including selected person)
            response = requests.get(settings.API_PEOPLE+f'get_bim/{system}/{crate_id}/')
            people_info = response.json()

            # Get floor SVG
            response = requests.get(settings.API_SPACE+f'get_floor_number_json/{system}/{floor_number}/')
            space_info = response.json()

            # Get person READING
            response = requests.get(settings.API_READINGS+'get/'+self.kwargs['person_id']+'/')
            readings_info = response.json()

            context['CRATE_ID'] = crate_id
            context['API_BIM_INFO'] = json.dumps(bim_info)
            context['API_PEOPLE_INFO'] = json.dumps(people_info)
            context['API_READINGS_INFO'] = json.dumps(readings_info)
            context['API_SPACE_INFO'] = json.dumps(space_info)
        else:
            # No crate_id, so pass limited info to template
            people_info = {}
            people_info[person_id] = person_info
            context['API_PEOPLE_INFO'] = json.dumps(people_info)

        return context

class PeoplePersonEditView(LoginRequiredMixin, TemplateView):
    template_name = 'people/person/person_edit.html'

    def post(self, request, person_id):
            person_metadata_str = request.POST.get('plain_text_value','{ "msg": "get failed" }')
            try:
                person_metadata_obj = json.loads(person_metadata_str)
            except json.decoder.JSONDecodeError:
                print(f'person_edit non-json in plain_text_value',file=sys.stderr)
                #DEBUG can return person_edit error message here
                return redirect('dm_person_edit',person_id=person_id)

            res = requests.post(settings.API_PEOPLE+'update/'+self.kwargs['person_id']+'/',
                                json=person_metadata_obj)
            if res.ok:
                print(f'person_edit wrote data to update',file=sys.stderr)
                return redirect('dm_person_history',person_id=person_id)
            else:
                print(f'person_edit bad response from api/people/update',file=sys.stderr)
                #DEBUG will return to edit page here
            return redirect('dm_person_history',person_id=person_id)

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)
            person_id = self.kwargs['person_id']
            response = requests.get(settings.API_PEOPLE+'get/'+person_id+'/')
            try:
                person_metadata = response.json()
            except json.decoder.JSONDecodeError:
                context["PERSON_METADATA"] = '{ "acp_error": "Person metadata unavailable" }'
                return context

            context['PERSON_ID'] = person_id
            context['PERSON_METADATA'] = json.dumps(person_metadata)

            return context

class PeoplePersonListView(LoginRequiredMixin, TemplateView):
    template_name = 'people/person_list.html'

    def get_context_data(self, **kwargs):
            context = super().get_context_data(**kwargs)

            # Make Persons API call to get person metadata for all people
            response = requests.get(settings.API_PEOPLE + 'list/?type_metadata=true')
            try:
                people_info = response.json()
            except json.decoder.JSONDecodeError:
                context["API_PEOPLE_INFO"] = '{ "acp_error": "Person metadata unavailable" }'
                return context

            context['API_PEOPLE_INFO'] = json.dumps(people_info)

            # e.g. &feature=temperature
            selected_feature = self.request.GET.get('feature',None)
            if selected_feature is not None:
                print("PeoplePersonListView feature in request '"+selected_feature)
                context['FEATURE'] = selected_feature
            else:
                print("PeoplePersonListView no feature",kwargs)

            return context
