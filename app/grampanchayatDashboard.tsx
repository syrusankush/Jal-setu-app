import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  FlatList, 
  Dimensions, 
  TextInput, 
  Alert, 
  ActivityIndicator, 
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
  RefreshControl
} from 'react-native';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { BarChart, PieChart, LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import WebView from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import * as DocumentPicker from 'expo-document-picker';

import { API_URL } from './config';
const screenWidth = Dimensions.get('window').width;

interface ComplaintFromDB {
  _id: string;
  title: string;
  status: string;
  location: string;
  description: string;
  image: string;
  createdAt: string;
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
  status: 'resolved' | 'pending' | 'escalated' | 'assigned';
  escalatedTo?: {
    uniqueId: string;
  };
  escalatedAt?: string;
  createdAt: string;
}

interface InventoryData {
  labels: string[];
  datasets: {
    data: number[];
  }[];
}

interface AssetData {
  name: string;
  value: number;
  condition: string;
}

interface AddPaymentForm {
  userId: string;
  amount: string;
  purpose: string;
  dueDate: string;
}

interface Transaction {
  _id: string;
  billNumber: string;
  amount: number;
  status: string;
  purpose: string;
  paymentDate: string;
  dueDate: string;
  userId: string;
  transactionType?: string;
  inventoryExpense?: {
    isInventoryUsed: boolean;
    items: {
      itemId: string;
      itemName: string;
      quantity: number;
      unit: string;
      cost: number;
    }[];
  };
}

interface Consumer {
  consumerId: string;
  totalPaid: number;
  pendingAmount: number;
  transactions: Transaction[];
}

interface CashBookStats {
  totalBillsGenerated: number;
  totalAmountCollected: number;
  totalExpenses: number;
  pendingAmount: number;
  netBalance: number;
}

interface BillForm {
  userId: string;
  amount: string;
  billType: 'Water Bill' | 'Maintenance Bill' | 'Other';
  dueDate: string;
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

interface InventoryStats {
  _id: string;  // category
  totalItems: number;
  totalValue: number;
  activeItems: number;
  maintenanceItems: number;
  lowStockItems: number;
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

interface UploadDocumentForm {
  title: string;
  description: string;
  documentType: 'REPORT' | 'PROPOSAL' | 'NOTICE' | 'OTHER';
  file?: {
    uri: string;
    name: string;
    type: string;
  };
}

// Add this interface to define the consolidated inventory item structure
interface ConsolidatedInventoryItem {
  category: string;
  quantity: number;
  unit: string;
  cost: number;
}

// Add this interface to define the consolidated inventory structure
interface ConsolidatedInventory {
  [key: string]: ConsolidatedInventoryItem;
}

const formatValue = (value: number): string => {
  if (value >= 100000) {
    return `${(value / 100000).toFixed(2)}L`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K`;
  }
  return value.toString();
};

const GramPanchayatDashboard = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [stats, setStats] = useState({
    resolved: 0,
    pending: 0,
    inProgress: 0
  });

  const [inventoryData, setInventoryData] = useState<InventoryData>({
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      data: [20, 45, 28, 80, 99, 43]
    }]
  });

  const [assetData] = useState<AssetData[]>([
    { name: 'Water Tanks', value: 250000, condition: 'Good' },
    { name: 'Pumps', value: 180000, condition: 'Fair' },
    { name: 'Pipelines', value: 320000, condition: 'Good' },
    { name: 'Treatment Plants', value: 450000, condition: 'Excellent' },
  ]);

  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [cashBook, setCashBook] = useState<{
    stats: CashBookStats;
    transactions: Transaction[];
  }>({
    stats: {
      totalBillsGenerated: 0,
      totalAmountCollected: 0,
      totalExpenses: 0,
      pendingAmount: 0,
      netBalance: 0
    },
    transactions: []
  });

  const [billForm, setBillForm] = useState<BillForm>({
    userId: '',
    amount: '',
    billType: 'Water Bill',
    dueDate: new Date().toISOString().split('T')[0]
  });

  const [refreshing, setRefreshing] = useState(false);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [gramPanchayatId, setGramPanchayatId] = useState<string>('');
  const [inventoryStats, setInventoryStats] = useState<InventoryStats[]>([]);

  const [resolutionModalVisible, setResolutionModalVisible] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [resolutionForm, setResolutionForm] = useState<ResolutionForm>({
    expenditure: '',
    inventoryUsed: [],
    remarks: ''
  });

  const [totalSolvedExpenditure, setTotalSolvedExpenditure] = useState(0);

  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadForm, setUploadForm] = useState<UploadDocumentForm>({
    title: '',
    description: '',
    documentType: 'OTHER'
  });

  // Add this to the state declarations
  const [inventoryModalVisible, setInventoryModalVisible] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({
    itemName: '',
    category: 'PIPES',
    quantity: '',
    unit: 'PIECES',
    cost: '',
    description: '',
    urgency: 'NORMAL' // LOW, NORMAL, HIGH
  });

  // Add this after the existing billForm state declaration
  const [isGeneratingForAll, setIsGeneratingForAll] = useState(false);

  useEffect(() => {
    const init = async () => {
      const gpId = await AsyncStorage.getItem('gramPanchayatId');
     // console.log('Initial GP ID:', gpId);
      if (gpId) {
        setGramPanchayatId(gpId);
        fetchInventoryItems(gpId);
      } else {
        console.warn('No gramPanchayatId found in storage');
      }
      // Fetch initial data
      fetchCashBook();
      fetchSolvedExpenditure();
    };
    
    init();
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, []);

  useEffect(() => {
    if (activeSection === 'consumers') {
      fetchConsumers();
    } else if (activeSection === 'cashbook') {
      fetchCashBook();
    } else if (activeSection === 'overview') {
      const init = async () => {
        const gpId = await AsyncStorage.getItem('gramPanchayatId');
        if (gpId) {
          await fetchInventoryItems(gpId);
        }
        await fetchComplaintStats();
        await fetchSolvedExpenditure();
      };
      init();
    }
  }, [activeSection]);

  useEffect(() => {
    const getPanchayatSamitiId = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
       // console.log('Fetching profile with token:', token);
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          }
        });
        
      //  console.log('Profile response status:', response.status);
        const data = await response.json();
      //  console.log('Profile data:', data);

        if (data.success && data.user.associatedTo && data.user.associatedTo.userId) {
          await AsyncStorage.setItem('panchayatSamitiId', data.user.associatedTo.userId._id);
       //   console.log('Stored PS ID:', data.user.associatedTo.userId._id);
        } else {
      //    console.log('No association found:', data);
        }
      } catch (error) {
        console.error('Error fetching Panchayat Samiti ID:', error);
      }
    };

    getPanchayatSamitiId();
  }, []);

  const fetchComplaints = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`${API_URL}/complaints`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch complaints');
      }
      
      const data = await response.json();
      if (data.success) {
        setComplaints(data.data);
      } else {
        throw new Error(data.message || 'Failed to fetch complaints');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
      console.error('Error fetching complaints:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConsumers = async () => {
    try {
      const response = await fetch(`${API_URL}/payment/consumers`, {
        headers: {
          'Authorization': `Bearer ${await AsyncStorage.getItem('token')}`,
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch consumers');
      
      const data = await response.json();
      if (data.success) {
        setConsumers(data.consumers);
      }
    } catch (error) {
      console.error('Error fetching consumers:', error);
      Alert.alert('Error', 'Failed to fetch consumers');
    }
  };

  const fetchCashBook = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/payment/cash-book`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch cash book');
      
      const data = await response.json();
      if (data.success) {
        setCashBook(data);
        
      }
    } catch (error) {
      console.error('Error fetching cash book:', error);
    }
  };

  const fetchInventoryItems = async (gpId: string) => {
    try {
      const token = await AsyncStorage.getItem('token');
      
   //   console.log('Fetching inventory items with:');
    //  console.log('GP ID:', gpId);
    //  console.log('API URL:', `${API_URL}/inventory/${gpId}/items`);

      const response = await fetch(`${API_URL}/inventory/${gpId}/items`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      const data = await response.json();
      

      if (!response.ok) throw new Error('Failed to fetch inventory items');
      
      if (data.success) {
        setInventoryItems(data.data);
      }
    } catch (error) {
      console.error('Error fetching inventory items:', error);
    }
  };

  const handleGenerateBill = async () => {
    try {
      if (!billForm.userId || !billForm.amount || !billForm.dueDate) {
        Alert.alert('Error', 'Please fill all required fields');
        return;
      }

      const response = await fetch(`${API_URL}/payment/add-pending`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await AsyncStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          userId: billForm.userId,
          amount: parseFloat(billForm.amount) * 100, // Convert to paise
          billType: billForm.billType,
          dueDate: billForm.dueDate,
          billPeriod: {
            from: new Date().toISOString(),
            to: new Date(billForm.dueDate).toISOString()
          }
        })
      });

      if (!response.ok) throw new Error('Failed to generate bill');

      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Bill generated successfully');
        setBillForm({
          userId: '',
          amount: '',
          billType: 'Water Bill',
          dueDate: new Date().toISOString().split('T')[0]
        });
        // Refresh consumers list and cash book
        fetchConsumers();
        fetchCashBook();
      }
    } catch (error) {
      console.error('Error generating bill:', error);
      Alert.alert('Error', 'Failed to generate bill');
    }
  };

  const handleSolveComplaint = async (complaintId: string) => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`${API_URL}/complaints/${complaintId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'resolved' })
      });

      if (!response.ok) {
        throw new Error('Failed to update complaint');
      }

      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Complaint marked as resolved');
        fetchComplaints();
      } else {
        throw new Error(data.message || 'Failed to update complaint');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update complaint';
      Alert.alert('Error', errorMessage);
      console.error('Error updating complaint:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const complaintStats = {
    resolved: complaints.filter(c => c.status === 'resolved').length,
    pending: complaints.filter(c => c.status === 'pending').length
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchComplaints();
      if (activeSection === 'consumers') {
        await fetchConsumers();
      } else if (activeSection === 'cashbook') {
        await fetchCashBook();
      } else if (activeSection === 'overview') {
        // Add these calls for overview section
        const gpId = await AsyncStorage.getItem('gramPanchayatId');
        if (gpId) {
          await fetchInventoryItems(gpId);
        }
        await fetchComplaintStats();
        await fetchSolvedExpenditure();
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [activeSection]);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true
      });

      if (!result.canceled) {
        const file = result.assets[0];
        setUploadForm(prev => ({
          ...prev,
          file: {
            uri: file.uri,
            name: file.name,
            type: 'application/pdf'
          }
        }));
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleUploadDocument = async () => {
    try {
      if (!uploadForm.file) {
        Alert.alert('Error', 'Please select a document to upload');
        return;
      }

      if (!uploadForm.title || !uploadForm.description) {
        Alert.alert('Error', 'Please fill all required fields');
        return;
      }

      const token = await AsyncStorage.getItem('token');
      const gpId = await AsyncStorage.getItem('gramPanchayatId');

      const formData = new FormData();
      
      // Important: match the field name with backend (document)
      formData.append('document', {
        uri: Platform.OS === 'ios' ? uploadForm.file.uri.replace('file://', '') : uploadForm.file.uri,
        type: 'application/pdf',
        name: uploadForm.file.name || 'document.pdf'
      } as any);

      formData.append('title', uploadForm.title);
      formData.append('description', uploadForm.description);
      formData.append('documentType', uploadForm.documentType);
      formData.append('gramPanchayatId', gpId || '');

      console.log('Uploading document:', {
        uri: uploadForm.file.uri,
        title: uploadForm.title,
        gpId
      });

      const response = await fetch(`${API_URL}/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          // Don't set Content-Type, let fetch set it with boundary
        },
        body: formData
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Response parsing error:', text);
        throw new Error('Invalid server response');
      }

      if (!response.ok) {
        throw new Error(data.message || 'Failed to upload document');
      }

      if (data.success) {
        Alert.alert('Success', 'Document uploaded successfully');
        setUploadModalVisible(false);
        setUploadForm({
          title: '',
          description: '',
          documentType: 'OTHER'
        });
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to upload document');
    }
  };

  const renderOverviewSection = () => (
    <ScrollView 
      style={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.statsCards}>
        <View style={styles.statsCard}>
          <Text style={styles.statsNumber}>₹{cashBook.stats.totalAmountCollected/100}</Text>
          <Text style={styles.statsLabel}>Total Collection</Text>
        </View>
        <View style={styles.statsCard}>
          <Text style={styles.statsNumber}>{cashBook.stats.totalBillsGenerated}</Text>
          <Text style={styles.statsLabel}>Bills Generated</Text>
        </View>
        <View style={styles.statsCard}>
          <Text style={styles.statsNumber}>₹{cashBook.stats.pendingAmount/100}</Text>
          <Text style={styles.statsLabel}>Pending Amount</Text>
        </View>
      </View>

      <View style={styles.uploadSection}>
        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={() => setUploadModalVisible(true)}
        >
          <Feather name="upload" size={24} color="#fff" />
          <Text style={styles.uploadButtonText}>Upload Document</Text>
        </TouchableOpacity>
      </View>

      {/* Complaint Statistics */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Complaint Statistics</Text>
        {isLoading ? (
          <ActivityIndicator size="large" color="#3b82f6" />
        ) : (
          <PieChart
            data={[
              {
                name: 'Resolved',
                population: complaintStats.resolved || 0,
                color: '#00E396',
                legendFontColor: '#7F7F7F',
              },
              {
                name: 'Pending',
                population: complaintStats.pending || 0,
                color: '#FF4560',
                legendFontColor: '#7F7F7F',
              },
            ]}
            width={Dimensions.get('window').width - 32}
            height={200}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        )}
      </View>

      {/* Inventory Levels Graph */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Inventory Levels</Text>
        <LineChart
          data={inventoryData}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16,
            },
          }}
          bezier
          style={styles.chart}
        />
      </View>

      {/* Inventory Table */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Current Inventory</Text>
        <ScrollView horizontal={false}>
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, { flex: 2, fontWeight: '600' }]}>Category</Text>
              <Text style={[styles.tableCell, { flex: 1, fontWeight: '600' }]}>Qty</Text>
              <Text style={[styles.tableCell, { flex: 1, fontWeight: '600' }]}>Unit</Text>
              <Text style={[styles.tableCell, { flex: 1, fontWeight: '600' }]}>Cost</Text>
            </View>
            {Object.values(consolidatedInventory).map((item: ConsolidatedInventoryItem, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{item.category}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{item.quantity}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{item.unit}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>₹{formatValue(item.cost)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Asset Utilization Graph */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Asset Utilization</Text>
        <LineChart
          data={{
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
              data: [65, 75, 82, 78, 88, 95]
            }]
          }}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 227, 150, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16,
            },
          }}
          bezier
          style={styles.chart}
        />
      </View>

      {/* Add this inside the renderOverviewSection, after the Current Inventory table */}
      <View style={styles.inventoryActions}>
        <TouchableOpacity 
          style={styles.addInventoryButton}
          onPress={() => setInventoryModalVisible(true)}
        >
          <Feather name="plus" size={20} color="#fff" />
          <Text style={styles.addInventoryButtonText}>Request Inventory</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderConsumersList = () => (
    <ScrollView 
      style={styles.section}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.sectionTitle}>Consumer List</Text>
      {consumers.map((consumer) => (
        <View key={consumer.consumerId} style={styles.consumerCard}>
          <View style={styles.consumerHeader}>
            <Text style={styles.consumerTitle}>Consumer ID: {consumer.consumerId}</Text>
            <View style={styles.consumerBadge}>
              <Text style={styles.consumerBadgeText}>
                {consumer.pendingAmount > 0 ? 'PENDING' : 'PAID'}
              </Text>
            </View>
          </View>
          
          <View style={styles.consumerStatsContainer}>
            <View style={styles.consumerStatItem}>
              <Text style={styles.statLabel}>Total Paid</Text>
              <Text style={styles.statAmount}>₹{consumer.totalPaid/100}</Text>
            </View>
            <View style={styles.consumerStatItem}>
              <Text style={styles.statLabel}>Pending</Text>
              <Text style={[styles.statAmount, consumer.pendingAmount > 0 && styles.pendingAmount]}>
                ₹{consumer.pendingAmount/100}
              </Text>
            </View>
          </View>

          <Text style={styles.subTitle}>Recent Transactions</Text>
          {consumer.transactions.map((transaction) => (
            <View key={transaction._id} style={styles.transactionItem}>
              <View style={styles.transactionMain}>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionTitle}>Bill #{transaction.billNumber}</Text>
                  <Text style={styles.transactionAmount}>₹{transaction.amount/100}</Text>
                  <Text style={styles.transactionDate}>
                    Due: {new Date(transaction.dueDate).toLocaleDateString()}
                  </Text>
                  <Text style={styles.transactionPurpose}>{transaction.purpose}</Text>
                </View>
                <View style={[
                  styles.transactionStatusBadge,
                  { backgroundColor: transaction.status === 'SUCCESS' ? '#00E396' : '#FF4560' }
                ]}>
                  <Text style={styles.statusBadgeText}>{transaction.status}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );

  const renderCashBook = () => (
    <ScrollView 
        style={styles.section}
        refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
    >
        <Text style={styles.sectionTitle}>Cash Book</Text>
        <View style={styles.statsCards}>
            <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>₹{cashBook.stats.netBalance/100}</Text>
                <Text style={styles.statsLabel}>Net Balance</Text>
            </View>
            <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>₹{cashBook.stats.totalAmountCollected/100}</Text>
                <Text style={styles.statsLabel}>Total Collections</Text>
            </View>
        </View>
        <View style={styles.statsCards}>
            <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>₹{cashBook.stats.totalExpenses/100}</Text>
                <Text style={styles.statsLabel}>Total Expenses</Text>
            </View>
            <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>₹{cashBook.stats.pendingAmount/100}</Text>
                <Text style={styles.statsLabel}>Pending Amount</Text>
            </View>
        </View>
        
        <Text style={styles.subTitle}>Recent Transactions</Text>
        {cashBook.transactions.map((transaction) => (
            <View key={transaction._id} style={styles.cashbookTransactionCard}>
                <View style={styles.transactionHeader}>
                    <View>
                        <Text style={styles.transactionTitle}>
                            {transaction.transactionType === 'DEBIT' ? 'Inventory Expense' : `Bill #${transaction.billNumber}`}
                        </Text>
                        {transaction.transactionType === 'DEBIT' ? (
                            <Text style={styles.transactionSubtitle}>Complaint Resolution</Text>
                        ) : (
                            <Text style={styles.transactionSubtitle}>Consumer ID: {transaction.userId}</Text>
                        )}
                    </View>
                    <View style={[
                        styles.transactionStatusBadge,
                        { 
                            backgroundColor: transaction.transactionType === 'DEBIT' 
                                ? '#FF4560' 
                                : transaction.status === 'SUCCESS' 
                                    ? '#00E396' 
                                    : '#FEB019' 
                        }
                    ]}>
                        <Text style={styles.statusBadgeText}>
                            {transaction.transactionType === 'DEBIT' ? 'DEBIT' : transaction.status}
                        </Text>
                    </View>
                </View>

                <View style={styles.transactionDetails}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Amount:</Text>
                        <Text style={[
                            styles.detailValue,
                            transaction.transactionType === 'DEBIT' && styles.debitAmount
                        ]}>
                            {transaction.transactionType === 'DEBIT' ? '- ' : ''}
                            ₹{transaction.amount/100}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Purpose:</Text>
                        <Text style={styles.detailValue}>{transaction.purpose}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Date:</Text>
                        <Text style={styles.detailValue}>
                            {new Date(transaction.paymentDate).toLocaleDateString()}
                        </Text>
                    </View>
                </View>

                {transaction.inventoryExpense?.isInventoryUsed && (
                    <View style={styles.inventoryDetails}>
                        <Text style={styles.inventoryTitle}>Inventory Used:</Text>
                        {transaction.inventoryExpense.items.map((item, index) => (
                            <View key={index} style={styles.inventoryItem}>
                                <Text style={styles.itemName}>{item.itemName}</Text>
                                <Text style={styles.itemQuantity}>
                                    {item.quantity} {item.unit}
                                </Text>
                                
                            </View>
                        ))}
                    </View>
                )}

                {transaction.status === 'SUCCESS' && transaction.transactionType !== 'DEBIT' && (
                    <TouchableOpacity 
                        style={styles.downloadButton}
                        onPress={() => handleDownloadReceipt(transaction._id)}
                    >
                        <MaterialIcons name="receipt" size={20} color="#fff" />
                        <Text style={styles.downloadButtonText}>Download Receipt</Text>
                    </TouchableOpacity>
                )}
            </View>
        ))}
    </ScrollView>
  );

  // Add this function before renderBillGeneration
  const handleGenerateForAll = async () => {
    try {
      if (!billForm.amount || !billForm.dueDate) {
        Alert.alert('Error', 'Please fill amount and due date fields');
        return;
      }

      setIsLoading(true);
      const response = await fetch(`${API_URL}/payment/add-pending-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await AsyncStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          amount: parseFloat(billForm.amount) * 100, // Convert to paise
          billType: billForm.billType,
          dueDate: billForm.dueDate,
          billPeriod: {
            from: new Date().toISOString(),
            to: new Date(billForm.dueDate).toISOString()
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', `Bills generated successfully for ${data.generatedCount} users`);
        setBillForm({
          userId: '',
          amount: '',
          billType: 'Water Bill',
          dueDate: new Date().toISOString().split('T')[0]
        });
        fetchConsumers();
        fetchCashBook();
      } else {
        throw new Error(data.message || 'Failed to generate bills');
      }
    } catch (error) {
      console.error('Error generating bills:', error);
      Alert.alert('Error', 'Failed to generate bills for all users');
    } finally {
      setIsLoading(false);
    }
  };

  // Modify the renderBillGeneration function to include the new toggle
  const renderBillGeneration = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView 
        style={styles.formContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Generate Bill</Text>
          
          <View style={styles.generateTypeSwitch}>
            <TouchableOpacity 
              style={[
                styles.switchButton, 
                !isGeneratingForAll && styles.activeSwitchButton
              ]}
              onPress={() => setIsGeneratingForAll(false)}
            >
              <Text style={[
                styles.switchButtonText,
                !isGeneratingForAll && styles.activeSwitchButtonText
              ]}>Single User</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.switchButton, 
                isGeneratingForAll && styles.activeSwitchButton
              ]}
              onPress={() => setIsGeneratingForAll(true)}
            >
              <Text style={[
                styles.switchButtonText,
                isGeneratingForAll && styles.activeSwitchButtonText
              ]}>All Users</Text>
            </TouchableOpacity>
          </View>

          {!isGeneratingForAll && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Consumer ID</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter Consumer ID"
                value={billForm.userId}
                onChangeText={(text) => setBillForm(prev => ({ ...prev, userId: text }))}
              />
            </View>
          )}

          {/* Rest of the form fields remain the same */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Amount (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter amount"
              keyboardType="decimal-pad"
              value={billForm.amount}
              onChangeText={(text) => setBillForm(prev => ({ ...prev, amount: text }))}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Bill Type</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={billForm.billType}
                onValueChange={(value) => setBillForm(prev => ({ ...prev, billType: value }))}
                style={styles.picker}
              >
                <Picker.Item label="Water Bill" value="Water Bill" />
                <Picker.Item label="Maintenance Bill" value="Maintenance Bill" />
                <Picker.Item label="Other" value="Other" />
              </Picker>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Due Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={billForm.dueDate}
              onChangeText={(text) => setBillForm(prev => ({ ...prev, dueDate: text }))}
            />
          </View>

          <TouchableOpacity 
            style={styles.submitButton}
            onPress={isGeneratingForAll ? handleGenerateForAll : handleGenerateBill}
          >
            <Text style={styles.submitButtonText}>
              {isGeneratingForAll ? 'Generate Bills for All Users' : 'Generate Bill'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderComplaintsSection = () => (
    <ScrollView style={styles.content}>
      {complaints.map((complaint) => (
        <View key={complaint._id} style={styles.complaintCard}>
          <View style={styles.complaintHeader}>
            <Text style={styles.complaintTitle}>{complaint.title}</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: complaint.status === 'resolved' ? '#00E396' : 
                complaint.status === 'escalated' ? '#FEB019' : '#FF4560' }
            ]}>
              <Text style={styles.statusText}>
                {complaint.status === 'escalated' ? 'Escalated to PS' : complaint.status}
              </Text>
            </View>
          </View>

          <Text style={styles.complaintDescription}>{complaint.description}</Text>
          
          {complaint.status === 'escalated' && (
            <Text style={styles.escalationInfo}>
              Escalated on: {new Date(complaint.escalatedAt || '').toLocaleDateString()}
            </Text>
          )}

          {complaint.image && (
            <TouchableOpacity 
              onPress={() => {
                setSelectedImage(complaint.image || '');
                setImageModalVisible(true);
              }}
            >
              <Image
                source={{ 
                  uri: `${API_URL.replace('/api', '')}/api/uploads/${complaint.image}`,
                  headers: {
                    'Cache-Control': 'no-cache'
                  },
                }}
                style={styles.complaintImage}
                resizeMode="cover"
                onError={(e) => {
              //    console.log('Image loading error:', e.nativeEvent.error);
               //   console.log('Attempted URL:', `${API_URL.replace('/api', '')}/api/uploads/${complaint.image}`);
                  Alert.alert('Error', 'Failed to load image');
                  setImageModalVisible(false);
                }}
              />
            </TouchableOpacity>
          )}
          
          <View style={styles.complaintFooter}>
            <Text style={styles.complaintLocation}>📍 {complaint.location}</Text>
            <Text style={styles.complaintDate}>
              {new Date(complaint.createdAt).toLocaleDateString()}
            </Text>
          </View>

          {complaint.status !== 'resolved' && 
           complaint.status !== 'escalated' && 
           complaint.status !== 'assigned' && (
            <View style={styles.complaintActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.solveButton]}
                onPress={() => {
                  setSelectedComplaintId(complaint._id);
                  setResolutionModalVisible(true);
                }}
              >
                <Text style={styles.actionButtonText}>Mark as Solved</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.escalateButton]}
                onPress={() => handleEscalateComplaint(complaint._id)}
              >
                <Text style={styles.actionButtonText}>Escalate</Text>
              </TouchableOpacity>
            </View>
          )}

          {complaint.status === 'assigned' && (
            <View style={styles.assignedBadge}>
              <Text style={styles.assignedText}>Assigned to Contract Agency</Text>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );

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

  const handleDownloadReceipt = async (transactionId: string) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/payment/receipt/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to download receipt');

      if (Platform.OS === 'web') {
        // Web platform handling
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `receipt-${transactionId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // Mobile platform handling
        const filename = `receipt-${transactionId}.pdf`;
        const fileUri = `${FileSystem.documentDirectory}${filename}`;

        // Download the file
        await FileSystem.downloadAsync(
          `${API_URL}/payment/receipt/${transactionId}`,
          fileUri,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        // Share the file which will allow user to choose a PDF viewer
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Open Receipt',
        });
      }
    } catch (error) {
      console.error('Error handling receipt:', error);
      Alert.alert('Error', 'Failed to open receipt');
    }
  };

  const handleResolveComplaint = async () => {
    try {
      if (!selectedComplaintId) {
        Alert.alert('Error', 'No complaint selected');
        return;
      }

      // Validate form data
      if (!resolutionForm.expenditure) {
        Alert.alert('Error', 'Please enter expenditure amount');
        return;
      }

      // Validate inventory items if any are added
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

     // console.log('Resolution response:', await response.clone().text());

      if (!response.ok) throw new Error('Failed to resolve complaint');

      const data = await response.json();
      if (data.success) {
      //  console.log('Resolution details:', data.data.solvedDetails);
        Alert.alert('Success', 'Complaint resolved successfully');
        setResolutionModalVisible(false);
        // Reset form
        setResolutionForm({
          expenditure: '',
          inventoryUsed: [],
          remarks: ''
        });
        fetchComplaints();
      }
    } catch (error) {
      console.error('Error resolving complaint:', error);
      Alert.alert('Error', 'Failed to resolve complaint');
    }
  };

  const handleEscalateComplaint = async (complaintId: string) => {
    try {
      const panchayatSamitiId = await AsyncStorage.getItem('panchayatSamitiId');
      
      if (!panchayatSamitiId) {
        // Try to fetch it again
        const token = await AsyncStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/users/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
        
        const data = await response.json();
        if (data.success && data.user.associatedTo && data.user.associatedTo.userId) {
          await AsyncStorage.setItem('panchayatSamitiId', data.user.associatedTo.userId._id);
         // console.log('Retrieved PS ID:', data.user.associatedTo.userId._id);
        } else {
          Alert.alert('Error', 'Could not find associated Panchayat Samiti');
          return;
        }
      }

      Alert.alert(
        'Confirm Escalation',
        'Are you sure you want to escalate this complaint to Panchayat Samiti?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Yes, Escalate',
            onPress: async () => {
              const token = await AsyncStorage.getItem('token');
              const psId = await AsyncStorage.getItem('panchayatSamitiId');
              
           //   console.log('Escalating complaint:', complaintId);
            //  console.log('To Panchayat Samiti:', psId);

              const response = await fetch(`${API_URL}/complaints/${complaintId}/escalate`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ panchayatSamitiId: psId })
              });

             // console.log('Escalation response status:', response.status);
              const data = await response.json();
           //   console.log('Escalation response:', data);

              if (!response.ok) throw new Error(data.message || 'Failed to escalate complaint');

              if (data.success) {
                Alert.alert('Success', 'Complaint escalated successfully');
                fetchComplaints();
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error escalating complaint:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to escalate complaint');
    }
  };

  const fetchSolvedExpenditure = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/complaints/solved-expenditure`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch solved expenditure');
      
      const data = await response.json();
      if (data.success) {
        setTotalSolvedExpenditure(data.totalExpenditure);
      }
    } catch (error) {
      console.error('Error fetching solved expenditure:', error);
    }
  };

  // Add this function to fetch complaint stats
  const fetchComplaintStats = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/complaints/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch complaint stats');
      
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching complaint stats:', error);
    }
  };

  useEffect(() => {
    if (activeSection === 'overview') {
      fetchComplaintStats();
      fetchSolvedExpenditure();
    }
  }, [activeSection]);

  const handleInventoryRequest = async () => {
    try {
      if (!inventoryForm.itemName || !inventoryForm.quantity || !inventoryForm.cost) {
        Alert.alert('Error', 'Please fill all required fields');
        return;
      }

      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/inventory/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(inventoryForm)
      });

      if (!response.ok) throw new Error('Failed to submit inventory request');

      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Inventory request submitted successfully');
        setInventoryModalVisible(false);
        setInventoryForm({
          itemName: '',
          category: 'PIPES',
          quantity: '',
          unit: 'PIECES',
          cost: '',
          description: '',
          urgency: 'NORMAL'
        });
      }
    } catch (error) {
      console.error('Error submitting inventory request:', error);
      Alert.alert('Error', 'Failed to submit inventory request');
    }
  };

  // First, let's consolidate the inventory items by category and unit
  const consolidatedInventory: ConsolidatedInventory = inventoryItems.reduce((acc: ConsolidatedInventory, item) => {
    const key = `${item.category}-${item.unit}`;
    if (!acc[key]) {
      acc[key] = {
        category: item.category,
        quantity: 0,
        unit: item.unit,
        cost: 0
      };
    }
    acc[key].quantity += item.quantity;
    acc[key].cost += item.cost;
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <Image 
        source={require('./bg1.jpg')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gram Panchayat Dashboard</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeSection === 'overview' && styles.activeTab]}
          onPress={() => setActiveSection('overview')}
        >
          <Feather 
            name="home" 
            size={24} 
            color={activeSection === 'overview' ? '#3b82f6' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeSection === 'overview' && styles.activeTabLabel]}>
            Home
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeSection === 'consumers' && styles.activeTab]}
          onPress={() => setActiveSection('consumers')}
        >
          <Feather 
            name="users" 
            size={24} 
            color={activeSection === 'consumers' ? '#3b82f6' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeSection === 'consumers' && styles.activeTabLabel]}>
            Users
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeSection === 'generate-bill' && styles.activeTab]}
          onPress={() => setActiveSection('generate-bill')}
        >
          <Feather 
            name="file-text" 
            size={24} 
            color={activeSection === 'generate-bill' ? '#3b82f6' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeSection === 'generate-bill' && styles.activeTabLabel]}>
            Bill
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeSection === 'cashbook' && styles.activeTab]}
          onPress={() => setActiveSection('cashbook')}
        >
          <Feather 
            name="book" 
            size={24} 
            color={activeSection === 'cashbook' ? '#3b82f6' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeSection === 'cashbook' && styles.activeTabLabel]}>
            Cash
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeSection === 'complaints' && styles.activeTab]}
          onPress={() => setActiveSection('complaints')}
        >
          <Feather 
            name="alert-circle" 
            size={24} 
            color={activeSection === 'complaints' ? '#3b82f6' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeSection === 'complaints' && styles.activeTabLabel]}>
            Complaints
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeSection === 'gis' && styles.activeTab]}
          onPress={() => setActiveSection('gis')}
        >
          <Feather 
            name="map" 
            size={24} 
            color={activeSection === 'gis' ? '#3b82f6' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeSection === 'gis' && styles.activeTabLabel]}>
            GIS Map
          </Text>
        </TouchableOpacity>
      </View>

      {activeSection === 'overview' && renderOverviewSection()}
      {activeSection === 'consumers' && renderConsumersList()}
      {activeSection === 'generate-bill' && renderBillGeneration()}
      {activeSection === 'cashbook' && renderCashBook()}
      {activeSection === 'complaints' && renderComplaintsSection()}
      {activeSection === 'gis' && renderGISSection()}

      <Modal
        visible={imageModalVisible}
        transparent={true}
        onRequestClose={() => setImageModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setImageModalVisible(false)}
        >
          {selectedImage && (
            <Image
              source={{ 
                uri: `${API_URL.replace('/api', '')}/api/uploads/${selectedImage}`,
                headers: {
                  'Cache-Control': 'no-cache'
                },
              }}
              style={styles.modalImage}
              resizeMode="contain"
              onError={(e) => {
             //   console.log('Modal image loading error:', e.nativeEvent.error);
              //  console.log('Attempted URL:', `${API_URL.replace('/api', '')}/api/uploads/${selectedImage}`);
                Alert.alert('Error', 'Failed to load image');
                setImageModalVisible(false);
              }}
            />
          )}
        </TouchableOpacity>
      </Modal>

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

              {/* Inventory Section */}
              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>Inventory Used</Text>
                <Text style={styles.sectionSubLabel}>Select items and quantities used for resolution</Text>
                
                {resolutionForm.inventoryUsed.map((item, index) => (
                  <View key={index} style={styles.inventoryItemCard}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemTitle}>Item {index + 1}</Text>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => {
                          const newInventoryUsed = [...resolutionForm.inventoryUsed];
                          newInventoryUsed.splice(index, 1);
                          setResolutionForm(prev => ({
                            ...prev,
                            inventoryUsed: newInventoryUsed
                          }));
                        }}
                      >
                        <MaterialIcons name="remove-circle" size={24} color="#dc2626" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.itemFields}>
                      <View style={styles.selectContainer}>
                        <Text style={styles.fieldLabel}>Select Item</Text>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={item.itemId}
                            style={styles.itemPicker}
                            onValueChange={(value) => {
                              const newInventoryUsed = [...resolutionForm.inventoryUsed];
                              newInventoryUsed[index].itemId = value;
                              const selectedItem = inventoryItems.find(inv => inv._id === value);
                              if (selectedItem) {
                                newInventoryUsed[index].unit = selectedItem.unit;
                              }
                              setResolutionForm(prev => ({
                                ...prev,
                                inventoryUsed: newInventoryUsed
                              }));
                            }}
                          >
                            <Picker.Item label="Select an item" value="" />
                            {inventoryItems.map((invItem) => (
                              <Picker.Item 
                                key={invItem._id} 
                                label={`${invItem.itemName} (${invItem.quantity} ${invItem.unit} available)`}
                                value={invItem._id} 
                              />
                            ))}
                          </Picker>
                        </View>
                      </View>

                      <View style={styles.quantityField}>
                        <Text style={styles.fieldLabel}>Quantity</Text>
                        <View style={styles.quantityWrapper}>
                          <TextInput
                            style={styles.quantityInput}
                            placeholder="Enter quantity"
                            keyboardType="numeric"
                            value={item.quantity}
                            onChangeText={(text) => {
                              const selectedItem = inventoryItems.find(inv => inv._id === item.itemId);
                              if (selectedItem && parseFloat(text) > selectedItem.quantity) {
                                Alert.alert('Error', `Only ${selectedItem.quantity} ${selectedItem.unit} available`);
        return;
      }
                              const newInventoryUsed = [...resolutionForm.inventoryUsed];
                              newInventoryUsed[index].quantity = text;
                              setResolutionForm(prev => ({
                                ...prev,
                                inventoryUsed: newInventoryUsed
                              }));
                            }}
                          />
                          <Text style={styles.unitLabel}>
                            {inventoryItems.find(inv => inv._id === item.itemId)?.unit || 'units'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.addItemButton}
                  onPress={() => setResolutionForm(prev => ({
                    ...prev,
                    inventoryUsed: [...prev.inventoryUsed, { itemId: '', quantity: '', unit: '' }]
                  }))}
                >
                  <MaterialIcons name="add-circle-outline" size={20} color="white" />
                  <Text style={styles.addItemText}>Add Item</Text>
                </TouchableOpacity>
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
                onPress={handleResolveComplaint}
              >
                <Text style={styles.buttonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={uploadModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setUploadModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Upload Document</Text>
            
            <View style={styles.formSection}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter document title"
                value={uploadForm.title}
                onChangeText={(text) => setUploadForm(prev => ({ ...prev, title: text }))}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter document description"
                multiline
                numberOfLines={4}
                value={uploadForm.description}
                onChangeText={(text) => setUploadForm(prev => ({ ...prev, description: text }))}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Document Type</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={uploadForm.documentType}
                  onValueChange={(value) => setUploadForm(prev => ({ ...prev, documentType: value }))}
                  style={styles.picker}
                >
                  <Picker.Item label="Report" value="REPORT" />
                  <Picker.Item label="Proposal" value="PROPOSAL" />
                  <Picker.Item label="Notice" value="NOTICE" />
                  <Picker.Item label="Other" value="OTHER" />
                </Picker>
              </View>
            </View>

            <TouchableOpacity
              style={styles.filePickerButton}
              onPress={handlePickDocument}
            >
              <Feather name="file-plus" size={24} color="#3b82f6" />
              <Text style={styles.filePickerText}>
                {uploadForm.file ? 'Change File' : 'Select PDF File'}
              </Text>
            </TouchableOpacity>

            {uploadForm.file && (
              <Text style={styles.selectedFileName}>
                Selected: {uploadForm.file.name}
              </Text>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.footerButton, styles.cancelButton]}
                onPress={() => setUploadModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerButton, styles.submitButton]}
                onPress={handleUploadDocument}
              >
                <Text style={styles.buttonText}>Upload</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={inventoryModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setInventoryModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request New Inventory</Text>
            
            <ScrollView style={styles.formScrollView}>
              <View style={styles.formSection}>
                <Text style={styles.label}>Item Name</Text>
                <TextInput
                  style={styles.input}
                  value={inventoryForm.itemName}
                  onChangeText={(text) => setInventoryForm(prev => ({...prev, itemName: text}))}
                  placeholder="Enter item name"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={inventoryForm.category}
                    onValueChange={(value) => setInventoryForm(prev => ({...prev, category: value}))}
                  >
                    <Picker.Item label="Pipes" value="PIPES" />
                    <Picker.Item label="Motors" value="MOTORS" />
                    <Picker.Item label="Tanks" value="TANKS" />
                    <Picker.Item label="Valves" value="VALVES" />
                    <Picker.Item label="Meters" value="METERS" />
                    <Picker.Item label="Chemicals" value="CHEMICALS" />
                    <Picker.Item label="Filters" value="FILTERS" />
                    <Picker.Item label="Other" value="OTHER" />
                  </Picker>
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={inventoryForm.quantity}
                  onChangeText={(text) => setInventoryForm(prev => ({...prev, quantity: text}))}
                  keyboardType="numeric"
                  placeholder="Enter quantity"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>Unit</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={inventoryForm.unit}
                    onValueChange={(value) => setInventoryForm(prev => ({...prev, unit: value}))}
                  >
                    <Picker.Item label="Pieces" value="PIECES" />
                    <Picker.Item label="Meters" value="METERS" />
                    <Picker.Item label="Liters" value="LITERS" />
                    <Picker.Item label="KG" value="KG" />
                  </Picker>
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>Estimated Cost (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={inventoryForm.cost}
                  onChangeText={(text) => setInventoryForm(prev => ({...prev, cost: text}))}
                  keyboardType="numeric"
                  placeholder="Enter estimated cost"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>Description & Justification</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={inventoryForm.description}
                  onChangeText={(text) => setInventoryForm(prev => ({...prev, description: text}))}
                  multiline
                  numberOfLines={4}
                  placeholder="Explain why this inventory is needed"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>Urgency Level</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={inventoryForm.urgency}
                    onValueChange={(value) => setInventoryForm(prev => ({...prev, urgency: value}))}
                  >
                    <Picker.Item label="Low" value="LOW" />
                    <Picker.Item label="Normal" value="NORMAL" />
                    <Picker.Item label="High" value="HIGH" />
                  </Picker>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.footerButton, styles.cancelButton]}
                onPress={() => setInventoryModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerButton, styles.submitButton]}
                onPress={handleInventoryRequest}
              >
                <Text style={styles.buttonText}>Submit Request</Text>
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
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 15,
    color: '#1A1A1A',
  },
  statsCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
    gap: 8,
  },
  statsCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  statsNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3b82f6',
  },
  statsLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  chartContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  complaintCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    marginHorizontal: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  transactionStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  cardDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    flex: 0.48,
  },
  escalateButton: {
    backgroundColor: '#FF4560',
  },
  solveButton: {
    backgroundColor: '#00E396',
  },
  buttonText: {
    color: '#fff',
    marginLeft: 5,
    fontWeight: '500',
  },
  content: {
    paddingBottom: 20,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 10
  },
  picker: {
    height: 50,
    width: '100%'
  },
  formContainer: {
    backgroundColor: 'transparent',
    padding: 16,
  },
  formContentContainer: {
    padding: 16,
    paddingBottom: 100, // Extra padding for keyboard
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1a1a1a',
  },
  complaintImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginVertical: 8,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputError: {
    borderColor: '#ff4444',
  },
  errorText: {
    color: '#FF4560',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  consumerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  consumerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  consumerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 8,
  },
  transactionItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  transactionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  transactionMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 4,
    borderRadius: 8,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  complaintTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  complaintDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  complaintLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  complaintDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  complaintActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  complaintsList: {
    padding: 16,
  },
  complaintFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  consumerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  consumerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  consumerBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  consumerStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  consumerStatItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  pendingAmount: {
    color: '#FF4560',
  },
  transactionInfo: {
    flex: 1,
    marginRight: 12,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginVertical: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cashbookTransactionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  transactionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  transactionDetails: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  transactionPurpose: {
    fontSize: 12,
    color: '#666',
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
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  downloadButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: 'white',
  },
  tableCell: {
    fontSize: 14,
    color: '#1a1a1a',
    textAlign: 'left',
    paddingHorizontal: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 24,
    textAlign: 'center',
  },
  formScrollView: {
    marginBottom: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  sectionSubLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  currencySymbol: {
    paddingHorizontal: 12,
    fontSize: 18,
    color: '#374151',
    backgroundColor: '#F3F4F6',
    height: '100%',
    textAlignVertical: 'center',
  },
  amountInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  inventoryItemCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  removeButton: {
    padding: 4,
  },
  itemFields: {
    gap: 16,
  },
  selectContainer: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  pickerWrapper: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  itemPicker: {
    height: 48,
  },
  quantityField: {
    flex: 1,
  },
  quantityWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  quantityInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  unitLabel: {
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    height: '100%',
    textAlignVertical: 'center',
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  addItemText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  remarksInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    fontSize: 16,
    color: '#111827',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  footerButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#EF4444',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
 
  escalationInfo: {
    fontSize: 12,
    color: '#FEB019',
    marginTop: 4,
    fontStyle: 'italic'
  },
  assignedBadge: {
    backgroundColor: '#3b82f6',
    padding: 8,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center'
  },
  assignedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500'
  },
  uploadSection: {
    padding: 16,
    alignItems: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
    borderRadius: 8,
    marginVertical: 16,
    gap: 8,
  },
  filePickerText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '500',
  },
  selectedFileName: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  debitAmount: {
    color: '#FF4560',
  },
  inventoryDetails: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  inventoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inventoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemName: {
    flex: 2,
    fontSize: 14,
    color: '#4B5563',
  },
  itemQuantity: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
  },
  itemCost: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'right',
  },
  inventoryActions: {
    padding: 16,
    alignItems: 'center',
  },
  addInventoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addInventoryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  generateTypeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  switchButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeSwitchButton: {
    backgroundColor: '#3b82f6',
  },
  switchButtonText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  activeSwitchButtonText: {
    color: '#ffffff',
  },
});

export default GramPanchayatDashboard;
