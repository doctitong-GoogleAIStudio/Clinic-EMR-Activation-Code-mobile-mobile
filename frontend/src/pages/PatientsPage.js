import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { 
  Users, Search, Plus, Phone, Mail, Calendar, ChevronRight, 
  User, Filter, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { getErrorMessage } from '../lib/utils';

const PatientsPage = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async (search = '') => {
    try {
      setLoading(true);
      const response = await patientAPI.getAll(search);
      setPatients(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load patients'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length >= 2 || query.length === 0) {
      fetchPatients(query);
    }
  };

  return (
    <div className="space-y-6" data-testid="patients-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900">Patients</h1>
          <p className="text-slate-500 font-body">{patients.length} registered patients</p>
        </div>
        <Button 
          className="bg-[#F97316] hover:bg-[#EA580C] text-white shadow-md"
          onClick={() => navigate('/patients/new')}
          data-testid="add-patient-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Patient
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="bg-white border-slate-100 shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name, mobile, or patient ID..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 h-11 bg-slate-50 border-slate-200"
                data-testid="patient-search-input"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patient List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#0F766E]/30 border-t-[#0F766E] rounded-full animate-spin" />
        </div>
      ) : patients.length === 0 ? (
        <Card className="bg-white border-slate-100 shadow-sm">
          <CardContent className="py-16 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-heading font-semibold text-slate-700">No patients found</h3>
            <p className="text-slate-500 mt-1 font-body">
              {searchQuery ? 'Try a different search term' : 'Start by adding your first patient'}
            </p>
            {!searchQuery && (
              <Button 
                className="mt-4 bg-[#0F766E] hover:bg-[#115E59]"
                onClick={() => navigate('/patients/new')}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Patient
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {patients.map((patient) => (
            <Card 
              key={patient.id}
              className="bg-white border-slate-100 shadow-sm hover:border-[#0F766E]/30 hover:shadow-md transition-all cursor-pointer"
              onClick={() => navigate(`/patients/${patient.id}`)}
              data-testid={`patient-card-${patient.id}`}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#0F766E]/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-[#0F766E]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading font-semibold text-slate-900">{patient.full_name}</h3>
                        <Badge variant="outline" className="font-mono text-xs bg-slate-50">
                          {patient.patient_id}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {patient.age} years, {patient.sex}
                        </span>
                        {patient.mobile && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {patient.mobile}
                          </span>
                        )}
                        {patient.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {patient.email}
                          </span>
                        )}
                      </div>
                      {(patient.allergies?.length > 0 || patient.chronic_conditions?.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {patient.allergies?.map((allergy, i) => (
                            <Badge key={i} variant="destructive" className="text-xs bg-red-100 text-red-700 border-red-200">
                              Allergy: {allergy}
                            </Badge>
                          ))}
                          {patient.chronic_conditions?.map((condition, i) => (
                            <Badge key={i} variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              {condition}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientsPage;
