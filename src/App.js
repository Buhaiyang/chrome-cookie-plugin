import React, { useContext, useState, useEffect, useRef } from "react";
import { Space, Table, Input, Button, Form } from "antd";
import { v4 } from "uuid";
import "./App.less";

const reg = /^https?:\/\/(([a-zA-Z0-9_-])+(\.)?)*(:\d+)?(\/((\.)?(\?)?=?&?[a-zA-Z0-9_-](\?)?)*)*$/i;
const EditableContext = React.createContext();
const EditableRow = ({ index, ...props }) => {
  const [form] = Form.useForm();
  return (
    <Form form={form} component={false}>
      <EditableContext.Provider value={form}>
        <tr {...props} />
      </EditableContext.Provider>
    </Form>
  );
};
const EditableCell = ({
  editable,
  children,
  dataIndex,
  record,
  handleSave,
  ...restProps
}) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef();
  const form = useContext(EditableContext);
  useEffect(() => {
    if (editing) {
      inputRef.current.focus();
    }
  }, [editing]);

  const toggleEdit = () => {
    setEditing(!editing);
    form.setFieldsValue({
      [dataIndex]: record[dataIndex],
    });
  };

  const save = async (e) => {
    try {
      const values = await form.validateFields([dataIndex]);
      toggleEdit();
      handleSave({ ...record, ...values });
    } catch (error) {}
  };

  let childNode = children;
  if (editable) {
    childNode = editing ? (
      <Form.Item
        name={dataIndex}
        rules={[
          {
            validator(rule, value) {
              if (reg.test(value)) {
                return Promise.resolve();
              }
              return Promise.reject("请输入正确地址");
            },
          },
        ]}
      >
        <Input
          ref={inputRef}
          onPressEnter={save}
          onBlur={save}
          autoComplete="off"
        />
      </Form.Item>
    ) : (
      <div className="editable-cell" onClick={toggleEdit} title={children[1]}>
        {children}
      </div>
    );
  }

  return <td {...restProps}>{childNode}</td>;
};
class App extends React.Component {
  state = {
    dataSource: [],
    selectedRowKeys: [],
    loading: false,
  };
  columns = [
    {
      title: "获取地址",
      dataIndex: "origin",
      width: "38%",
      ellipsis: true,
      onCell: (record) => ({
        record,
        editable: true,
        dataIndex: "origin",
        handleSave: this.handleSave,
      }),
    },
    {
      title: "注入地址",
      dataIndex: "target",
      width: "38%",
      ellipsis: true,
      onCell: (record) => ({
        record,
        editable: true,
        dataIndex: "target",
        handleSave: this.handleSave,
      }),
    },
    {
      title: "操作",
      dataIndex: "control",
      width: "16%",
      render: (text, record) => (
        <div className="delete" onClick={() => this.handleDelete(record.key)}>
          删除
        </div>
      ),
    },
  ];

  componentDidMount() {
    const {
      chrome: { storage },
    } = window;
    if (storage) {
      storage.sync.get(
        ["plugin_cookies", "plugin_cookies_selected_keys"],
        (data) => {
          console.log(data);
          const {
            plugin_cookies = [],
            plugin_cookies_selected_keys = [],
          } = data;
          this.setState({
            dataSource: plugin_cookies,
            selectedRowKeys: plugin_cookies_selected_keys,
          });
        }
      );
    }
  }

  onSelectChange = (selectedRowKeys) => {
    this.setState({ selectedRowKeys }, () => {
      const {
        chrome: { storage },
      } = window;
      if (storage) {
        storage.sync.set({ plugin_cookies_selected_keys: selectedRowKeys });
      }
    });
  };

  handleDelete = (key) => {
    const { dataSource } = this.state;
    this.setState(
      { dataSource: dataSource.filter((item) => item.key !== key) },
      () => {
        const { dataSource } = this.state;
        const {
          chrome: { storage },
        } = window;
        if (storage) {
          storage.sync.set({ plugin_cookies: dataSource });
        }
      }
    );
  };

  handleAdd = () => {
    const { dataSource } = this.state;
    const newData = {
      key: v4(),
      origin: "",
      target: "http://localhost",
    };
    this.setState({
      dataSource: [...dataSource, newData],
    });
  };

  handleSave = (row) => {
    const { dataSource } = this.state;
    const index = dataSource.findIndex((item) => row.key === item.key);
    const item = dataSource[index];
    dataSource.splice(index, 1, { ...item, ...row });
    this.setState({ dataSource: [...dataSource] }, () => {
      const { dataSource } = this.state;
      const {
        chrome: { storage },
      } = window;
      if (storage) {
        storage.sync.set({ plugin_cookies: dataSource });
      }
    });
  };

  handleClear = () => {
    const {
      chrome: { storage },
    } = window;
    if (storage) {
      storage.sync.remove(
        ["plugin_cookies", "plugin_cookies_selected_keys"],
        () => {
          this.setState({ dataSource: [], selectedRowKeys: [] });
        }
      );
    }
  };

  syncCookie = () => {
    const { loading } = this.state;
    if (loading) {
      return;
    }
    this.setState({ loading: true }, () => {
      const {
        chrome: { cookies },
      } = window;
      if (cookies) {
        const { dataSource, selectedRowKeys } = this.state;
        for (const { origin, target, key } of dataSource) {
          if (selectedRowKeys.includes(key) && origin) {
            cookies.getAll({ url: origin }, (cookie) => {
              for (const { name, value } of cookie) {
                cookies.set({
                  url: target,
                  name,
                  value,
                });
              }
            });
          }
        }
      }
      setTimeout(() => {
        this.setState({ loading: false });
      }, 300);
    });
  };

  render() {
    const { dataSource, selectedRowKeys, loading } = this.state;
    const components = {
      body: {
        row: EditableRow,
        cell: EditableCell,
      },
    };
    const rowSelection = {
      selectedRowKeys,
      onChange: this.onSelectChange,
    };

    return (
      <div className="wrapper">
        <Space>
          <Button onClick={this.handleAdd} type="primary" size="small">
            添加
          </Button>
          <Button onClick={this.handleClear} type="primary" size="small">
            清空
          </Button>
          <Button
            onClick={this.syncCookie}
            type="primary"
            size="small"
            loading={loading}
          >
            同步Cookie
          </Button>
        </Space>
        <Table
          components={components}
          rowClassName={() => "editable-row"}
          dataSource={dataSource}
          columns={this.columns}
          rowSelection={rowSelection}
          siz="small"
          locale={{ emptyText: "暂无配置" }}
          pagination={{ size: "small", pageSize: 3, hideOnSinglePage: false }}
        />
      </div>
    );
  }
}

export default App;
