import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  TextInput,
  RefreshControl,
  Dimensions,
  Modal
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';
import * as ImagePicker from 'expo-image-picker';

interface Tender {
  _id: string;
  tenderId: string;
  title: string;
  village: string;
  estimatedCost: number;
  type: 'Well Construction' | 'Pipeline Repair' | 'Water Tank Installation';
  status: 'active' | 'closed' | 'awarded';
}

interface AssignedWork {
  _id: string;
  complaintId: {
    title: string;
    description: string;
    location: string;
    image: string;
  };
  status: 'assigned' | 'in-progress' | 'completed';
  estimatedCost: number;
  deadline: string;
}

// Add this interface for completion form
interface CompletionForm {
  expenditure: string;
  remarks: string;
  workPhotos: string[];
}

// Add this interface for bids
interface WorkBid {
  workId: string;
  bidAmount: string;
  proposedDuration: string;
  status: 'pending' | 'accepted' | 'rejected';
}

const MOCK_TENDERS: Tender[] = [
  {
    _id: '1',
    tenderId: 'T001',
    title: 'Well Construction',
    village: 'Village A',
    estimatedCost: 50000,
    type: 'Well Construction',
    status: 'active'
  },
  {
    _id: '2',
    tenderId: 'T002',
    title: 'Pipeline Repair Work',
    village: 'Village B',
    estimatedCost: 30000,
    type: 'Pipeline Repair',
    status: 'active'
  },
  {
    _id: '3',
    tenderId: 'T003',
    title: 'Water Tank Installation',
    village: 'Village C',
    estimatedCost: 100000,
    type: 'Water Tank Installation',
    status: 'active'
  },
  {
    _id: '4',
    tenderId: 'T004',
    title: 'Well Maintenance',
    village: 'Village D',
    estimatedCost: 25000,
    type: 'Well Construction',
    status: 'active'
  }
];

// Remove or comment out this mock data
/*const MOCK_ASSIGNED_WORKS: AssignedWork[] = [
  {
    _id: '1',
    complaintId: {
      title: 'Emergency Pipeline Fix',
      description: 'Fix water pipeline leak near main road',
      location: 'Main Road, Village A'
    },
    status: 'in-progress',
    estimatedCost: 15000,
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: '2',
    complaintId: {
      title: 'Well Repair',
      description: 'Repair damaged well structure',
      location: 'North Side, Village B'
    },
    status: 'assigned',
    estimatedCost: 25000,
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  }
];*/

const ContractAgencyDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [assignedWorks, setAssignedWorks] = useState<AssignedWork[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add these new state variables
  const [completionModal, setCompletionModal] = useState(false);
  const [selectedWork, setSelectedWork] = useState<AssignedWork | null>(null);
  const [completionForm, setCompletionForm] = useState<CompletionForm>({
    expenditure: '',
    remarks: '',
    workPhotos: []
  });

  // Add state for bids
  const [workBids, setWorkBids] = useState<{ [key: string]: WorkBid }>({});
  const [bidModal, setBidModal] = useState(false);
  const [selectedWorkForBid, setSelectedWorkForBid] = useState<AssignedWork | null>(null);

  const fetchTenders = async () => {
    try {
      // Comment out the API call for now
      /*const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/tenders/active`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch tenders');

      const data = await response.json();
      if (data.success) {
        setTenders(data.data);
      }*/

      // Use mock data instead
      setTenders(MOCK_TENDERS);
    } catch (error) {
      console.error('Error fetching tenders:', error);
    }
  };

  const fetchAssignedWorks = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/assigned-work/agency-works`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch works');
      }

      const data = await response.json();
      if (data.success) {
        setAssignedWorks(data.data);
      }
    } catch (error) {
      console.error('Error fetching works:', error);
      Alert.alert('Error', 'Failed to fetch assigned works');
    }
  };

  useEffect(() => {
    fetchTenders();
    fetchAssignedWorks();
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      // Fetch all data in parallel
      await Promise.all([
        fetchTenders(),
        fetchAssignedWorks()
      ]);
      
      // Reset any filters or search
      setSearchQuery('');
      
      // Reset any form states
      setCompletionForm({
        expenditure: '',
        remarks: '',
        workPhotos: []
      });
      
      // Reset bid states
      setWorkBids({});
      
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      Alert.alert('Error', 'Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Add RefreshControl to all scrollable sections
  const renderRefreshControl = () => (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  );

  // Add this function to handle work completion
  const handleCompleteWork = async () => {
    try {
      if (!selectedWork) return;
      if (!completionForm.expenditure) {
        Alert.alert('Error', 'Please enter expenditure amount');
        return;
      }

      const formData = new FormData();
      formData.append('expenditure', completionForm.expenditure);
      formData.append('remarks', completionForm.remarks);

      completionForm.workPhotos.forEach((photo, index) => {
        formData.append('workPhotos', {
          uri: photo,
          type: 'image/jpeg',
          name: `photo${index}.jpg`
        } as any);
      });

      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/assigned-work/${selectedWork._id}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to complete work');
      }

      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Work marked as completed');
        setCompletionModal(false);
        setCompletionForm({
          expenditure: '',
          remarks: '',
          workPhotos: []
        });
        fetchAssignedWorks();
      }
    } catch (error) {
      console.error('Error completing work:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to complete work');
    }
  };

  // Add this function to handle image picking
  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setCompletionForm(prev => ({
        ...prev,
        workPhotos: [...prev.workPhotos, result.assets[0].uri]
      }));
    }
  };

  // Add function to handle bid submission
  const handleSubmitBid = async (workId: string) => {
    const bid = workBids[workId];
    if (!bid || !bid.bidAmount || !bid.proposedDuration) {
      Alert.alert('Error', 'Please enter bid amount and duration');
      return;
    }

    // Here you would normally make an API call
    // For now, just update the local state
    setWorkBids(prev => ({
      ...prev,
      [workId]: {
        ...bid,
        status: 'pending'
      }
    }));

    setBidModal(false);
    Alert.alert('Success', 'Bid submitted successfully');
  };

  // Update the renderDashboard function to match the image layout
  const renderDashboard = () => (
    <ScrollView 
      style={styles.content}
      refreshControl={renderRefreshControl()}
    >
      <Text style={styles.sectionTitle}>Active Tenders</Text>
      {assignedWorks.map((work) => (
        <View key={work._id} style={styles.tenderCard}>
          {work.complaintId.image ? (
            <Image 
              source={{ uri: `${API_URL}/uploads/${work.complaintId.image}` }}
              style={styles.tenderImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.tenderImage, { backgroundColor: '#3b82f6' }]} />
          )}
          <View style={styles.tenderInfo}>
            <Text style={styles.tenderTitle}>{work.complaintId.title}</Text>
            <Text style={styles.tenderDetail}> {work.complaintId.location}</Text>
            <Text style={styles.tenderAmount}>₹{work.estimatedCost}</Text>
            <TouchableOpacity 
              style={[styles.applyButton, { backgroundColor: '#00E396' }]}
              onPress={() => {
                setSelectedWorkForBid(work);
                setBidModal(true);
              }}
            >
              <Text style={styles.applyButtonText}>Tenderize Work</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Applications Overview</Text>
      <View style={styles.applicationsRow}>
        <View style={styles.applicationCard}>
          <View style={styles.contractorPlaceholder}>
            <Feather name="user" size={24} color="#fff" />
          </View>
          <View style={styles.applicationInfo}>
            <Text style={styles.contractorName}>Contractor A</Text>
            <Text style={styles.bidInfo}>₹45,000 • 3 months</Text>
          </View>
        </View>
        <View style={styles.applicationCard}>
          <View style={styles.contractorPlaceholder}>
            <Feather name="user" size={24} color="#fff" />
          </View>
          <View style={styles.applicationInfo}>
            <Text style={styles.contractorName}>Contractor B</Text>
            <Text style={styles.bidInfo}>₹48,000 • 4 months</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Finalization Process</Text>
      <View style={styles.finalizationCard}>
        <Text style={styles.finalizationTitle}>Tender Progress</Text>
        <Text style={styles.tenderCount}>5 tenders</Text>
        <Text style={styles.timeInfo}>Last 30 days +10%</Text>
        {/* Add the line chart here if needed */}
      </View>
    </ScrollView>
  );

  // Add a new render function for assigned works
  const renderAssignedWorks = () => (
    <ScrollView 
      style={styles.content}
      refreshControl={renderRefreshControl()}
    >
      <Text style={styles.sectionTitle}>Assigned Works</Text>
      {assignedWorks.map((work) => (
        <View key={work._id} style={styles.workCard}>
          <View style={styles.workHeader}>
            <Text style={styles.workTitle}>{work.complaintId.title}</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: 
                work.status === 'completed' ? '#00E396' :
                work.status === 'in-progress' ? '#FEB019' : '#3b82f6'
              }
            ]}>
              <Text style={styles.statusText}>{work.status}</Text>
            </View>
          </View>

          {work.complaintId.image && (
            <Image
              source={{ uri: `${API_URL}/uploads/${work.complaintId.image}` }}
              style={styles.complaintImage}
              resizeMode="cover"
            />
          )}

          <Text style={styles.workDescription}>{work.complaintId.description}</Text>
          <Text style={styles.workLocation}>📍 {work.complaintId.location}</Text>

          <View style={styles.workDetails}>
            <Text style={styles.detailText}>
              Estimated Cost: ₹{work.estimatedCost}
            </Text>
            <Text style={styles.detailText}>
              Deadline: {new Date(work.deadline).toLocaleDateString()}
            </Text>
          </View>

          {work.status !== 'completed' && (
            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => {
                setSelectedWork(work);
                setCompletionModal(true);
              }}
            >
              <Text style={styles.buttonText}>Mark as Completed</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.backgroundImage} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Village Water System</Text>
            </View>

      <View style={styles.searchBar}>
        <Feather name="search" size={20} color="#666" />
              <TextInput
          style={styles.searchInput}
          placeholder="Search tenders or contractors"
          value={searchQuery}
          onChangeText={setSearchQuery}
              />
            </View>

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'dashboard' && styles.activeTab]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Feather name="grid" size={24} color={activeTab === 'dashboard' ? '#3b82f6' : '#666'} />
          <Text style={styles.tabLabel}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'assigned-works' && styles.activeTab]}
          onPress={() => setActiveTab('assigned-works')}
        >
          <Feather name="briefcase" size={24} color={activeTab === 'assigned-works' ? '#3b82f6' : '#666'} />
          <Text style={styles.tabLabel}>Assigned Works</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'assigned-works' && renderAssignedWorks()}

      <Modal
        visible={completionModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCompletionModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Work Completion Details</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Expenditure (₹)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={completionForm.expenditure}
                onChangeText={(text) => setCompletionForm(prev => ({
                  ...prev,
                  expenditure: text
                }))}
                placeholder="Enter amount spent"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Remarks</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={4}
                value={completionForm.remarks}
                onChangeText={(text) => setCompletionForm(prev => ({
                  ...prev,
                  remarks: text
                }))}
                placeholder="Add any completion remarks"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Work Photos</Text>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={handlePickImage}
              >
                <Feather name="camera" size={24} color="#3b82f6" />
                <Text style={styles.photoButtonText}>Add Photo</Text>
              </TouchableOpacity>

              <ScrollView horizontal style={styles.photosList}>
                {completionForm.workPhotos.map((photo, index) => (
                  <Image
                    key={index}
                    source={{ uri: photo }}
                    style={styles.photoPreview}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setCompletionModal(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleCompleteWork}
              >
                <Text style={styles.buttonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={bidModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setBidModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Place Your Bid</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Bid Amount (₹)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Enter your bid amount"
                value={selectedWorkForBid ? workBids[selectedWorkForBid._id]?.bidAmount : ''}
                onChangeText={(text) => {
                  if (selectedWorkForBid) {
                    setWorkBids(prev => ({
                      ...prev,
                      [selectedWorkForBid._id]: {
                        ...prev[selectedWorkForBid._id],
                        bidAmount: text,
                        status: 'pending'
                      }
                    }));
                  }
                }}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Proposed Duration (days)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Enter completion duration"
                value={selectedWorkForBid ? workBids[selectedWorkForBid._id]?.proposedDuration : ''}
                onChangeText={(text) => {
                  if (selectedWorkForBid) {
                    setWorkBids(prev => ({
                      ...prev,
                      [selectedWorkForBid._id]: {
                        ...prev[selectedWorkForBid._id],
                        proposedDuration: text,
                        status: 'pending'
                      }
                    }));
                  }
                }}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setBidModal(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={() => selectedWorkForBid && handleSubmitBid(selectedWorkForBid._id)}
              >
                <Text style={styles.buttonText}>Submit Bid</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.1,
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 4,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  tenderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  tenderImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    margin: 12,
  },
  tenderInfo: {
    flex: 1,
    padding: 12,
  },
  tenderTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  tenderDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  tenderAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 12,
  },
  applyButton: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  workCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  workHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  workDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  workLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  workDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  completeButton: {
    backgroundColor: '#00E396',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    marginBottom: 12,
  },
  photoButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#3b82f6',
  },
  photosList: {
    flexDirection: 'row',
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#3b82f6',
  },
  submitButton: {
    backgroundColor: '#00E396',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  complaintImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginVertical: 12,
  },
  bidSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
  },
  bidButton: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  bidButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  bidInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  bidAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 4,
  },
  bidDuration: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  bidStatus: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 4,
  },
  bidStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  applicationsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  applicationCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  contractorPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3b82f6',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applicationInfo: {
    flex: 1,
  },
  contractorName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  finalizationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  finalizationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  tenderCount: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  timeInfo: {
    fontSize: 14,
    color: '#00E396',
  },
  filterBar: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  activeFiltersScroll: {
    marginTop: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3b82f6',
    alignSelf: 'flex-start',
  },
  filterButtonText: {
    marginLeft: 8,
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  activeFilterText: {
    color: '#3b82f6',
    fontSize: 14,
    marginRight: 8,
  },
});

export default ContractAgencyDashboard; 