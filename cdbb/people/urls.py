# data_management/urls.py
from django.urls import path

from .views import PeopleHomeView
# People:
from .views import PeoplePersonView, PeoplePersonLocationView, PeoplePersonHistoryView
from .views import PeoplePersonEditView, PeoplePersonListView
# Groups:
#from .views import PeopleGroupView, PeopleGroupsView, PeopleGroupEditView, PeopleGroupHistoryView
# Insts:
#from .views import PeopleInstHomeView, PeopleInstMetadataView, PeopleInstLocationView, PeopleInstHistoryView, PeopleInstEditView

urlpatterns = [
    path('home/', PeopleHomeView.as_view(), name='people_home'),

    path('person/<person_id>/', PeoplePersonView.as_view(), name='people_person'),
    path('person_location/<person_id>/', PeoplePersonLocationView.as_view(), name='people_person_location'),
    path('person_history/<person_id>/', PeoplePersonHistoryView.as_view(), name='people_person_history'),
    path('person_edit/<person_id>/', PeoplePersonEditView.as_view(), name='people_person_edit'),
    path('person_list/', PeoplePersonListView.as_view(), name='people_person_list')

#    path('group/<group_id>/', PeopleGroupView.as_view(), name='people_group'),
#    path('group_edit/<group_id>/', PeopleGroupEditView.as_view(), name='people_group_edit'),
#    path('group_history/<group_id>/', PeopleGroupHistoryView.as_view(), name='people_group_history'),
#    path('groups/', PeopleGroupsView.as_view(), name='people_groups'),

#    path('inst_home/', PeopleInstHomeView.as_view(), name='people_inst_home'),
#    path('inst/<inst_id>/', PeopleInstLocationView.as_view(), name='people_inst'),
#    path('inst_location/<inst_id>/', PeopleInstLocationView.as_view(), name='people_inst_location'),
#    path('inst_metadata/<inst_id>/', PeopleInstMetadataView.as_view(), name='people_inst_metadata'),
#    path('inst_history/<inst_id>/', PeopleInstHistoryView.as_view(), name='people_inst_history'),
#    path('inst_edit/<inst_id>/', PeopleInstEditView.as_view(), name='people_inst_edit')
]
