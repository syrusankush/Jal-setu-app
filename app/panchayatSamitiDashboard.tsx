import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  Dimensions,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Platform,
  
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BarChart, PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';
import WebView from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import * as base64 from 'base64-js';

interface GramPanchayat {
  id: string;
  name: string;
  imageUrl: string;
  stats: {
    totalFunds: number;
    fundsUtilized: number;
    pendingComplaints: number;
    resolvedComplaints: number;
  };
}

interface Complaint {
  _id: string;
  title: string;
  description: string;
  location: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  image?: string;
  status: 'resolved' | 'pending' | 'escalated';
  createdAt: string;
}

interface EscalatedComplaint extends Complaint {
  escalatedAt: string;
  gramPanchayatId: {
    uniqueId: string;
  };
}

interface ResolutionForm {
  expenditure: string;
  inventoryUsed: {
    itemId: string;
    quantity: string;
    unit: string;
  }[];
  remarks: string;
}

interface InventoryItem {
  _id: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  cost: number;
  condition: string;
  status: string;
}

interface FilterOptions {
  village: string;
  dateRange: 'all' | 'today' | 'week' | 'month';
}

interface Document {
  _id: string;
  title: string;
  description: string;
  fileUrl: string;
  gramPanchayatId: string;
  uploadedBy: {
    _id: string;
    name: string;
  };
  uploadedAt: string;
  documentType: 'REPORT' | 'PROPOSAL' | 'NOTICE' | 'OTHER';
}

interface GPDocument {
  _id: string;
  title: string;
  description: string;
  fileUrl: string;
  documentType: 'REPORT' | 'PROPOSAL' | 'NOTICE' | 'OTHER';
  uploadedAt: string;
  uploadedBy: {
    name: string;
  };
  gramPanchayatId: {
    uniqueId: string;
    name: string;
  };
}

interface ChartData {
  labels: string[];
  datasets: Array<{
    data: number[];
  }>;
}

interface DotProps {
  x: number;
  y: number;
  index: number;
}

interface InventoryRequest {
  _id: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  cost: number;
  description: string;
  urgency: 'LOW' | 'NORMAL' | 'HIGH';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  gramPanchayatId: {
    uniqueId: string;
    name: string;
  };
  createdAt: string;
}

const PanchayatSamitiDashboard = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [selectedGP, setSelectedGP] = useState<GramPanchayat | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [gramPanchayats, setGramPanchayats] = useState<GramPanchayat[]>([
    {
      id: '1',
      name: 'Lamkani',
      imageUrl: 'https://example.com/gp1.jpg',
      stats: {
        totalFunds: 1000000,
        fundsUtilized: 750000,
        pendingComplaints: 15,
        resolvedComplaints: 45
      }
    },
    {
      id: '2',
      name: 'Nandane',
      imageUrl: 'https://example.com/gp2.jpg',
      stats: {
        totalFunds: 1500000,
        fundsUtilized: 1200000,
        pendingComplaints: 8,
        resolvedComplaints: 32
      }
    },
    {
      id: '3',
      name: 'Nikumbhe',
      imageUrl: 'https://example.com/gp3.jpg',
      stats: {
        totalFunds: 800000,
        fundsUtilized: 600000,
        pendingComplaints: 12,
        resolvedComplaints: 28
      }
    }
  ]);

  const [escalatedComplaints, setEscalatedComplaints] = useState<EscalatedComplaint[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'complaints' | 'gis' | 'documents' | 'inventory'>('overview');
  const [resolutionModalVisible, setResolutionModalVisible] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [resolutionForm, setResolutionForm] = useState<ResolutionForm>({
    expenditure: '',
    inventoryUsed: [],
    remarks: ''
  });
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    village: 'all',
    dateRange: 'all'
  });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentModalVisible, setDocumentModalVisible] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedGPDocuments, setSelectedGPDocuments] = useState<GPDocument[]>([]);
  const [inventoryRequests, setInventoryRequests] = useState<InventoryRequest[]>([]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      // Fetch all data in parallel
      await Promise.all([
        fetchGramPanchayats(),
        fetchEscalatedComplaints(),
        fetchDocuments(),
        fetchInventoryRequests()
      ]);
      
      // Reset map if on GIS section
      if (activeTab === 'gis') {
        setMapKey(prev => prev + 1);
      }
      
      // Reset any filters
      setFilterOptions({
        village: 'all',
        dateRange: 'all'
      });
      
      // Clear any selections
      setSelectedGP(null);
      setSelectedDocument(null);
      
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      Alert.alert('Error', 'Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [activeTab]);

  const fetchGramPanchayats = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      // Implement API call to fetch gram panchayats
    } catch (error) {
      console.error('Error fetching gram panchayats:', error);
    }
  };

  const fetchEscalatedComplaints = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/complaints/escalated`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) throw new Error('Failed to fetch escalated complaints');

      const data = await response.json();
      if (data.success) {
        setEscalatedComplaints(data.data);
      }
    } catch (error) {
      console.error('Error fetching escalated complaints:', error);
      Alert.alert('Error', 'Failed to fetch escalated complaints');
    }
  };

  useEffect(() => {
    fetchEscalatedComplaints();
  }, []);

  const handleResolveComplaint = async (complaintId: string) => {
    try {
      setSelectedComplaintId(complaintId);
      setResolutionModalVisible(true);
    } catch (error) {
      console.error('Error resolving complaint:', error);
      Alert.alert('Error', 'Failed to resolve complaint');
    }
  };

  const handleSubmitResolution = async () => {
    try {
      if (!selectedComplaintId) {
        Alert.alert('Error', 'No complaint selected');
        return;
      }

      if (!resolutionForm.expenditure) {
        Alert.alert('Error', 'Please enter expenditure amount');
        return;
      }

      if (resolutionForm.inventoryUsed.length > 0) {
        const invalidItems = resolutionForm.inventoryUsed.filter(
          item => !item.itemId || !item.quantity
        );
        if (invalidItems.length > 0) {
          Alert.alert('Error', 'Please fill all inventory item details');
          return;
        }
      }

      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/complaints/${selectedComplaintId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          expenditure: parseFloat(resolutionForm.expenditure),
          inventoryUsed: resolutionForm.inventoryUsed.map(item => ({
            itemId: item.itemId,
            quantity: parseFloat(item.quantity),
            unit: item.unit || inventoryItems.find(inv => inv._id === item.itemId)?.unit || 'PIECES'
          })),
          remarks: resolutionForm.remarks || 'No remarks'
        })
      });

      if (!response.ok) throw new Error('Failed to resolve complaint');

      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Complaint resolved successfully');
        setResolutionModalVisible(false);
        setResolutionForm({
          expenditure: '',
          inventoryUsed: [],
          remarks: ''
        });
        fetchEscalatedComplaints();
      }
    } catch (error) {
      console.error('Error resolving complaint:', error);
      Alert.alert('Error', 'Failed to resolve complaint');
    }
  };

  const handleEscalateToZP = async (complaintId: string) => {
    try {
      Alert.alert(
        'Confirm Escalation',
        'Are you sure you want to escalate this complaint to Zilla Parishad?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Yes, Escalate',
            onPress: async () => {
              const token = await AsyncStorage.getItem('token');
              const zpId = await AsyncStorage.getItem('zpId');
              
              console.log('Escalating complaint:', complaintId);
              console.log('To ZP:', zpId);

              const response = await fetch(`${API_URL}/complaints/${complaintId}/escalate`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ panchayatSamitiId: zpId })
              });

              console.log('Escalation response status:', response.status);
              const data = await response.json();
              console.log('Escalation response:', data);

              if (!response.ok) throw new Error(data.message || 'Failed to escalate complaint');

              if (data.success) {
                Alert.alert('Success', 'Complaint escalated to ZP successfully');
                fetchEscalatedComplaints();
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error escalating complaint:', error);
      Alert.alert('Error', 'Failed to escalate complaint');
    }
  };

  useEffect(() => {
    const getZPId = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
        
        const data = await response.json();
        if (data.success && data.user.associatedTo && data.user.associatedTo.userId) {
          await AsyncStorage.setItem('zpId', data.user.associatedTo.userId._id);
          console.log('Stored ZP ID:', data.user.associatedTo.userId._id);
        }
      } catch (error) {
        console.error('Error fetching ZP ID:', error);
      }
    };

    getZPId();
  }, []);

  const fetchDocuments = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      console.log('Fetching documents...');
      
      const response = await fetch(`${API_URL}/documents/gram-panchayat`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) throw new Error('Failed to fetch documents');

      const data = await response.json();
      console.log('Documents response:', data);
      
      if (data.success) {
        setDocuments(data.data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      Alert.alert('Error', 'Failed to fetch documents');
    }
  };

  // Move getPSId outside useEffect
  const getPSId = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      const data = await response.json();
      if (data.success && data.user.associatedTo && data.user.associatedTo.userId) {
        await AsyncStorage.setItem('psId', data.user.associatedTo.userId._id);
      }
    } catch (error) {
      console.error('Error fetching PS ID:', error);
    }
  };

  // Remove the old useEffect with getPSId and keep only this one
  useEffect(() => {
    const initializeData = async () => {
      try {
        await getPSId();
        await fetchDocuments();
      } catch (error) {
        console.error('Error initializing data:', error);
      }
    };

    initializeData();
  }, []);

  const handleViewDocument = async (doc: Document | GPDocument) => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      // Create a local URI for the file using cache directory
      const fileUri = `${FileSystem.cacheDirectory}${doc.fileUrl}`;
      
      // Download the file directly using FileSystem
      const { uri } = await FileSystem.downloadAsync(
        `${API_URL}/documents/view/${doc.fileUrl}`,
        fileUri,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(uri, {
          UTI: 'com.adobe.pdf',
          mimeType: 'application/pdf'
        });
      } else {
        const contentUri = await FileSystem.getContentUriAsync(uri);
        
        try {
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: 1,
            type: 'application/pdf',
          });
        } catch (error) {
          console.log('Error opening with intent:', error);
          // Fallback to sharing if viewing fails
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Open PDF Document'
          });
        }
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      Alert.alert('Error', 'Failed to open document. Please try again.');
    }
  };

  // Add RefreshControl to all scrollable sections
  const renderRefreshControl = () => (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  );

  const renderOverviewSection = () => {
    const selectedVillageData = filterOptions.village === 'all' ? null : 
      gramPanchayats.find(gp => gp.name === filterOptions.village);

    const contactInfo = {
      secretary: {
        name: "Rajesh Sharma",
        email: "rajesh.sharma@panchayat.gov.in",
        phone: "+91 94567 23890"
      }
    };

    return (
      <ScrollView 
        style={styles.content}
        refreshControl={renderRefreshControl()}
      >
        {selectedVillageData ? (
          <>
            <View style={styles.statsCards}>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>
                  ₹{(selectedVillageData.stats.totalFunds/100000).toString()}L
                </Text>
                <Text style={styles.statsLabel}>Total Funds</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>
                  ₹{(selectedVillageData.stats.fundsUtilized/100000).toString()}L
                </Text>
                <Text style={styles.statsLabel}>Utilized</Text>
              </View>
            </View>

            <View style={styles.statsCards}>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>
                  {selectedVillageData.stats.resolvedComplaints.toString()}
                </Text>
                <Text style={styles.statsLabel}>Resolved</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>
                  {selectedVillageData.stats.pendingComplaints.toString()}
                </Text>
                <Text style={styles.statsLabel}>Pending</Text>
              </View>
            </View>

            {/* Add Complaints Pie Chart */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Complaints Overview</Text>
              <PieChart
                data={[
                  {
                    name: "Resolved",
                    population: selectedVillageData.stats.resolvedComplaints,
                    color: '#00E396',
                    legendFontColor: '#7F7F7F',
                    legendFontSize: 12,
                  },
                  {
                    name: "Pending",
                    population: selectedVillageData.stats.pendingComplaints,
                    color: '#FF4560',
                    legendFontColor: '#7F7F7F',
                    legendFontSize: 12,
                  },
                ]}
                width={Dimensions.get('window').width - 32}
                height={200}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  propsForLabels: {
                    fontSize: 12,
                  },
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </View>

            {/* Add Contact Information Section */}
            <View style={styles.contactSection}>
              <Text style={styles.contactTitle}>Contact Information</Text>
              
              <View style={[styles.contactCard, { marginBottom: 0 }]}>
                <View style={styles.contactHeader}>
                  <Feather name="user" size={24} color="#3b82f6" />
                  <Text style={styles.contactRole}>Block Development Officer</Text>
                </View>
                <Text style={styles.contactName}>{contactInfo.secretary.name}</Text>
                <View style={styles.contactDetail}>
                  <Feather name="mail" size={16} color="#666" />
                  <Text style={styles.contactText}>{contactInfo.secretary.email}</Text>
                </View>
                <View style={styles.contactDetail}>
                  <Feather name="phone" size={16} color="#666" />
                  <Text style={styles.contactText}>{contactInfo.secretary.phone}</Text>
                </View>
              </View>
            </View>

            {renderDocumentsSection()}
          </>
        ) : (
          <>
            <View style={styles.statsCards}>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>₹1.5Cr</Text>
                <Text style={styles.statsLabel}>Total Funds</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>₹75L</Text>
                <Text style={styles.statsLabel}>Utilized</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>60</Text>
                <Text style={styles.statsLabel}>Complaints</Text>
              </View>
            </View>

            {/* Add Funds Distribution Chart */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Funds Distribution by Village</Text>
              <BarChart
                data={{
                  labels: gramPanchayats.map(gp => gp.name.substring(0, 6)),
                  datasets: [{
                    data: gramPanchayats.map(gp => gp.stats.totalFunds/100000)
                  }]
                }}
                width={Dimensions.get('window').width - 32}
                height={220}
                yAxisLabel="₹"
                yAxisSuffix="L"
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  propsForLabels: {
                    fontSize: 12,
                  },
                }}
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
                fromZero
                showValuesOnTopOfBars
              />
            </View>

            {/* Show list of all villages */}
            <Text style={styles.sectionTitle}>Village List</Text>
            {gramPanchayats.map((gp) => (
              <TouchableOpacity 
                key={gp.id} 
                style={styles.gpCard}
                onPress={() => {
                  setSelectedGP(gp);
                  setFilterOptions(prev => ({ ...prev, village: gp.name }));
                }}
              >
                <View style={styles.gpInfo}>
                  <Text style={styles.gpName}>{gp.name}</Text>
                  <View style={styles.gpStats}>
                    <Text style={styles.gpStatText}>
                      Funds: ₹{gp.stats.totalFunds/100000}L
                    </Text>
                    <Text style={styles.gpStatText}>
                      Complaints: {gp.stats.pendingComplaints + gp.stats.resolvedComplaints}
                    </Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={24} color="#666" />
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    );
  };

  const renderEscalatedComplaints = () => {
    const filteredComplaints = getFilteredComplaints();
    
    return (
      <ScrollView 
        style={styles.section}
        refreshControl={renderRefreshControl()}
      >
        <Text style={styles.sectionTitle}>Escalated Complaints</Text>
        
        {filteredComplaints.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No complaints match your filters</Text>
          </View>
        ) : (
          filteredComplaints.map((complaint) => (
            <View key={complaint._id} style={styles.complaintCard}>
              <View style={styles.complaintHeader}>
                <Text style={styles.complaintTitle}>{complaint.title}</Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: '#FF4560' }
                ]}>
                  <Text style={styles.statusText}>Escalated</Text>
                </View>
              </View>

              <Text style={styles.complaintDescription}>{complaint.description}</Text>
              
              {complaint.image && (
                <Image
                  source={{ 
                    uri: `${API_URL.replace('/api', '')}/api/uploads/${complaint.image}` 
                  }}
                  style={styles.complaintImage}
                  resizeMode="cover"
                />
              )}
              
              <View style={styles.complaintFooter}>
                <Text style={styles.complaintLocation}>📍 {complaint.location}</Text>
                <Text style={styles.complaintDate}>
                  Escalated: {new Date(complaint.escalatedAt).toLocaleDateString()}
                </Text>
                <Text style={styles.complaintSource}>
                  From: {complaint.gramPanchayatId.uniqueId}
                </Text>
              </View>

              <View style={styles.complaintActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.solveButton]}
                  onPress={() => handleResolveComplaint(complaint._id)}
                >
                  <Text style={styles.actionButtonText}>Mark as Solved</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.escalateButton]}
                  onPress={() => handleEscalateToZP(complaint._id)}
                >
                  <Text style={styles.actionButtonText}>Escalate to ZP</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  const getFilteredComplaints = () => {
    return escalatedComplaints.filter(complaint => {
      // Village filter
      if (filterOptions.village !== 'all' && 
          complaint.gramPanchayatId.uniqueId !== filterOptions.village) {
        return false;
      }
      
      // Date filter
      const complaintDate = new Date(complaint.escalatedAt);
      const today = new Date();
      
      switch (filterOptions.dateRange) {
        case 'today':
          return complaintDate.toDateString() === today.toDateString();
        case 'week':
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return complaintDate >= weekAgo;
        case 'month':
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return complaintDate >= monthAgo;
        default:
          return true;
      }
    });
  };

  const renderGISSection = () => (
    <View style={[styles.gisContainer, isFullScreen && styles.fullScreenContainer]}>
      <View style={[
        styles.mapHeader, 
        { paddingTop: isFullScreen ? 40 : 16 }
      ]}>
        <Text style={styles.sectionTitle}>GIS Mapping</Text>
        <View style={styles.mapControls}>
          <TouchableOpacity 
            style={styles.mapButton}
            onPress={() => setMapKey(prev => prev + 1)}
          >
            <Feather name="refresh-cw" size={20} color="#3b82f6" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.mapButton}
            onPress={() => setIsFullScreen(!isFullScreen)}
          >
            <Feather 
              name={isFullScreen ? "minimize-2" : "maximize-2"} 
              size={20} 
              color="#3b82f6" 
            />
          </TouchableOpacity>
        </View>
      </View>
      <View style={[styles.mapContainer, isFullScreen && styles.fullScreenMap]}>
        <WebView
          key={mapKey}
          source={{ uri: 'http://10.140.65.102:5501/index.html#17/21.05176/74.65401' }}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>
    </View>
  );

  const renderDocumentsSection = () => (
    <ScrollView 
      style={styles.documentsContainer}
      refreshControl={renderRefreshControl()}
    >
      <View style={styles.documentsHeader}>
        <Text style={styles.sectionTitle}>Documents</Text>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setFilterVisible(true)}
        >
          <Feather name="filter" size={20} color="#3b82f6" />
          <Text style={styles.filterButtonText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {documents.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="file-text" size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>No documents found</Text>
        </View>
      ) : (
        <View style={styles.documentsGrid}>
          {documents.map((doc) => (
            <TouchableOpacity
              key={doc._id}
              style={styles.documentCard}
              onPress={() => handleViewDocument(doc)}
            >
              <View style={styles.documentIcon}>
                <Feather name="file-text" size={24} color="#3b82f6" />
              </View>
              <Text style={styles.documentTitle} numberOfLines={2}>
                {doc.title}
              </Text>
              <Text style={styles.documentDate}>
                {new Date(doc.uploadedAt).toLocaleDateString()}
              </Text>
              <View style={styles.documentType}>
                <Text style={styles.documentTypeText}>{doc.documentType}</Text>
              </View>
              <Text style={styles.documentUploader}>
                By: {doc.uploadedBy.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );

  // Move this function outside useEffect and before handleInventoryAction
  const fetchInventoryRequests = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/inventory/requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) throw new Error('Failed to fetch inventory requests');

      const data = await response.json();
      if (data.success) {
        setInventoryRequests(data.data);
      }
    } catch (error) {
      console.error('Error fetching inventory requests:', error);
    }
  };

  // Update the useEffect to just call the function
  useEffect(() => {
    fetchInventoryRequests();
  }, []);

  const renderInventoryRequests = () => (
    <ScrollView 
      style={styles.section}
      refreshControl={renderRefreshControl()}
    >
      <Text style={styles.sectionTitle}>Inventory Requests</Text>
      {inventoryRequests.map((request) => (
        <View key={request._id} style={styles.requestCard}>
          <View style={styles.requestHeader}>
            <Text style={styles.requestTitle}>{request.itemName}</Text>
            <View style={[
              styles.urgencyBadge,
              { backgroundColor: request.urgency === 'HIGH' ? '#FF4560' : 
                               request.urgency === 'NORMAL' ? '#FEB019' : '#00E396' }
            ]}>
              <Text style={styles.urgencyText}>{request.urgency}</Text>
            </View>
          </View>

          <View style={styles.requestDetails}>
            <Text style={styles.detailLabel}>From: {request.gramPanchayatId.name}</Text>
            <Text style={styles.detailLabel}>
              Quantity: {request.quantity} {request.unit}
            </Text>
            <Text style={styles.detailLabel}>Cost: ₹{request.cost}</Text>
            <Text style={styles.detailLabel}>Category: {request.category}</Text>
            <Text style={styles.description}>{request.description}</Text>
          </View>

          {request.status === 'PENDING' && (
            <View style={styles.requestActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleInventoryAction(request._id, 'APPROVED')}
              >
                <Text style={styles.actionButtonText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleInventoryAction(request._id, 'REJECTED')}
              >
                <Text style={styles.actionButtonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );

  const handleInventoryAction = async (requestId: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/inventory/requests/${requestId}/${action.toLowerCase()}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) throw new Error(`Failed to ${action.toLowerCase()} request`);

      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', `Request ${action.toLowerCase()} successfully`);
        // Refresh the requests list
        fetchInventoryRequests();
      }
    } catch (error) {
      console.error('Error handling inventory request:', error);
      Alert.alert('Error', `Failed to ${action.toLowerCase()} request`);
    }
  };

  return (
    <View style={styles.container}>
      <Image 
        source={require('./bg1.jpg')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Panchayat Samiti Dashboard</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Feather 
            name="home" 
            size={24} 
            color={activeTab === 'overview' ? '#3b82f6' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeTab === 'overview' && styles.activeTabLabel]}>
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'complaints' && styles.activeTab]}
          onPress={() => setActiveTab('complaints')}
        >
          <Feather 
            name="alert-circle" 
            size={24} 
            color={activeTab === 'complaints' ? '#3b82f6' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeTab === 'complaints' && styles.activeTabLabel]}>
            Complaints
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'gis' && styles.activeTab]}
          onPress={() => setActiveTab('gis')}
        >
          <Feather 
            name="map" 
            size={24} 
            color={activeTab === 'gis' ? '#3b82f6' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeTab === 'gis' && styles.activeTabLabel]}>
            GIS Map
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'documents' && styles.activeTab]}
          onPress={() => setActiveTab('documents')}
        >
          <Feather 
            name="file-text" 
            size={24} 
            color={activeTab === 'documents' ? '#3b82f6' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeTab === 'documents' && styles.activeTabLabel]}>
            Documents
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'inventory' && styles.activeTab]}
          onPress={() => setActiveTab('inventory')}
        >
          <Feather 
            name="package" 
            size={24} 
            color={activeTab === 'inventory' ? '#3b82f6' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeTab === 'inventory' && styles.activeTabLabel]}>
            Inventory
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'overview' && (
        <>
          <View style={styles.filterBar}>
            <TouchableOpacity 
              style={styles.filterButton}
              onPress={() => setFilterVisible(true)}
            >
              <Feather name="filter" size={20} color="#3b82f6" />
              <Text style={styles.filterButtonText}>Filter Villages</Text>
            </TouchableOpacity>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeFiltersScroll}>
              {filterOptions.village !== 'all' && (
                <View style={styles.activeFilter}>
                  <Text style={styles.activeFilterText}>
                    Village: {filterOptions.village}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setFilterOptions(prev => ({ ...prev, village: 'all' }));
                      setSelectedGP(null);
                    }}
                  >
                    <Feather name="x" size={16} color="#3b82f6" />
                  </TouchableOpacity>
                </View>
              )}

              {filterOptions.dateRange !== 'all' && (
                <View style={styles.activeFilter}>
                  <Text style={styles.activeFilterText}>
                    Date: {filterOptions.dateRange === 'today' ? 'Today' : 
                           filterOptions.dateRange === 'week' ? 'This Week' : 'This Month'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setFilterOptions(prev => ({ ...prev, dateRange: 'all' }))}
                  >
                    <Feather name="x" size={16} color="#3b82f6" />
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
          {renderOverviewSection()}
        </>
      )}
      {activeTab === 'complaints' && renderEscalatedComplaints()}
      {activeTab === 'gis' && renderGISSection()}
      {activeTab === 'documents' && renderDocumentsSection()}
      {activeTab === 'inventory' && renderInventoryRequests()}

      <Modal
        visible={resolutionModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setResolutionModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Resolution Details</Text>
            
            <ScrollView style={styles.formScrollView}>
              {/* Expenditure Section */}
              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>Expenditure Amount</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="Enter amount in rupees"
                    keyboardType="numeric"
                    value={resolutionForm.expenditure}
                    onChangeText={(text) => {
                      const numericValue = text.replace(/[^0-9]/g, '');
                      setResolutionForm(prev => ({
                        ...prev,
                        expenditure: numericValue
                      }))
                    }}
                  />
                </View>
              </View>

              {/* Remarks Section */}
              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>Remarks</Text>
                <TextInput
                  style={styles.remarksInput}
                  placeholder="Enter any additional notes or remarks"
                  multiline
                  numberOfLines={4}
                  value={resolutionForm.remarks}
                  onChangeText={(text) => setResolutionForm(prev => ({
                    ...prev,
                    remarks: text
                  }))}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.footerButton, styles.cancelButton]}
                onPress={() => setResolutionModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerButton, styles.submitButton]}
                onPress={handleSubmitResolution}
              >
                <Text style={styles.buttonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={filterVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.filterModalContent}>
            <Text style={styles.filterTitle}>Filter Village Data</Text>
            
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Select Village</Text>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    filterOptions.village === 'all' && styles.filterOptionActive
                  ]}
                  onPress={() => setFilterOptions(prev => ({ ...prev, village: 'all' }))}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filterOptions.village === 'all' && styles.filterOptionTextActive
                  ]}>
                    All Villages
                  </Text>
                </TouchableOpacity>
                {[
                  { id: '1', name: 'Lamkani' },
                  { id: '2', name: 'Nandane' },
                  { id: '3', name: 'Nikumbhe' },
                  { id: '4', name: 'Lonkheda' },
                  { id: '5', name: 'Dondaicha' },
                  { id: '6', name: 'Shindkheda' }
                ].map(village => (
                  <TouchableOpacity
                    key={village.id}
                    style={[
                      styles.filterOption,
                      filterOptions.village === village.name && styles.filterOptionActive
                    ]}
                    onPress={() => {
                      setFilterOptions(prev => ({ ...prev, village: village.name }));
                      const selectedGP = gramPanchayats.find(gp => gp.name === village.name);
                      if (selectedGP) {
                        setSelectedGP(selectedGP);
                      }
                    }}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filterOptions.village === village.name && styles.filterOptionTextActive
                    ]}>
                      {village.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Date Range</Text>
              <View style={styles.filterOptions}>
                {[
                  { value: 'all', label: 'All Time' },
                  { value: 'today', label: 'Today' },
                  { value: 'week', label: 'This Week' },
                  { value: 'month', label: 'This Month' }
                ].map(({ value, label }) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.filterOption,
                      filterOptions.dateRange === value && styles.filterOptionActive
                    ]}
                    onPress={() => setFilterOptions(prev => ({ 
                      ...prev, 
                      dateRange: value as FilterOptions['dateRange'] 
                    }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filterOptions.dateRange === value && styles.filterOptionTextActive
                    ]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterActions}>
              <TouchableOpacity
                style={[styles.filterActionButton, styles.filterCancelButton]}
                onPress={() => setFilterVisible(false)}
              >
                <Text style={styles.filterActionButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterActionButton, styles.filterApplyButton]}
                onPress={() => {
                  setFilterVisible(false);
                }}
              >
                <Text style={styles.filterActionButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={documentModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDocumentModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.documentModalContent}>
            <Text style={styles.documentModalTitle}>View Document</Text>
            
            <View style={styles.documentSection}>
              <Text style={styles.documentLabel}>Title</Text>
              <TextInput
                style={styles.documentInput}
                placeholder="Enter title"
                value={selectedDocument?.title}
                onChangeText={(text) => {
                  setSelectedDocument(prev => prev ? {
                    ...prev,
                    title: text,
                  } : null);
                }}
              />
            </View>

            <View style={styles.documentSection}>
              <Text style={styles.documentLabel}>Description</Text>
              <TextInput
                style={styles.documentInput}
                placeholder="Enter description"
                value={selectedDocument?.description}
                onChangeText={(text) => {
                  setSelectedDocument(prev => prev ? {
                    ...prev,
                    description: text,
                  } : null);
                }}
              />
            </View>

            <View style={styles.documentSection}>
              <Text style={styles.documentLabel}>Document Type</Text>
              <TextInput
                style={styles.documentInput}
                placeholder="Enter document type"
                value={selectedDocument?.documentType}
                onChangeText={(text) => {
                  setSelectedDocument(prev => prev ? {
                    ...prev,
                    documentType: text as 'REPORT' | 'PROPOSAL' | 'NOTICE' | 'OTHER',
                  } : null);
                }}
              />
            </View>

            <View style={styles.documentActions}>
              <TouchableOpacity
                style={[styles.documentActionButton, styles.documentCancelButton]}
                onPress={() => setDocumentModalVisible(false)}
              >
                <Text style={styles.documentActionButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.documentActionButton, styles.documentApplyButton]}
                onPress={() => {
                  setDocumentModalVisible(false);
                }}
              >
                <Text style={styles.documentActionButtonText}>Apply</Text>
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
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 1,
    zIndex: -1,
  },
  header: {
    backgroundColor: '#3b82f6',
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  statsCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statsNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3b82f6',
  },
  statsLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  chartContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 12,
  },
  gpCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  gpImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  gpInfo: {
    flex: 1,
  },
  gpName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  gpStats: {
    flexDirection: 'row',
    gap: 12,
  },
  gpStatText: {
    fontSize: 12,
    color: '#666',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    marginLeft: 8,
    color: '#3b82f6',
    fontSize: 16,
  },
  section: {
    padding: 16,
  },
  complaintCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  complaintTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  complaintDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  complaintImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  complaintFooter: {
    marginTop: 8,
  },
  complaintLocation: {
    fontSize: 14,
    color: '#666',
  },
  complaintDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  complaintSource: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 4,
  },
  complaintActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  solveButton: {
    backgroundColor: '#00E396',
  },
  escalateButton: {
    backgroundColor: '#FF4560',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 10,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  activeTabLabel: {
    color: '#3b82f6',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  formScrollView: {
    maxHeight: 300,
  },
  formSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
  },
  remarksInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  footerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  submitButton: {
    backgroundColor: '#3b82f6',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '500',
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
  filterModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  filterTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#374151',
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: '30%',
  },
  filterOptionActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterOptionText: {
    color: '#666',
    fontSize: 16,
  },
  filterOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  filterActionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  filterCancelButton: {
    backgroundColor: '#ccc',
  },
  filterApplyButton: {
    backgroundColor: '#3b82f6',
  },
  filterActionButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  gisContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  mapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    margin: 16,
  },
  map: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: 'white',
  },
  fullScreenMap: {
    margin: 0,
    borderRadius: 0,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  mapControls: {
    flexDirection: 'row',
    gap: 8,
  },
  mapButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  documentsContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  documentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  documentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  documentCard: {
    width: '48%', // For 2 columns
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  documentDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  documentType: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  documentTypeText: {
    fontSize: 10,
    color: '#3b82f6',
    fontWeight: '500',
  },
  documentUploader: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
  documentModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  documentModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  documentSection: {
    marginBottom: 24,
  },
  documentLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#374151',
  },
  documentInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
  documentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  documentActionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  documentCancelButton: {
    backgroundColor: '#ccc',
  },
  documentApplyButton: {
    backgroundColor: '#3b82f6',
  },
  documentActionButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  contactSection: {
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  contactCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactRole: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    color: '#3b82f6',
  },
  contactName: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  contactDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  contactText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  chartLabel: {
    fontSize: 12,
    color: '#666',
  },
  requestCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  urgencyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  urgencyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  requestDetails: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  approveButton: {
    backgroundColor: '#00E396',
  },
  rejectButton: {
    backgroundColor: '#FF4560',
  },
});

export default PanchayatSamitiDashboard;
