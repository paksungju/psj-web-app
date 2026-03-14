import styled from 'styled-components';
import 'react-resizable/css/styles.css';


export const colors = ["#ccc","#000","#FF5733", "#33FF57", "#3357FF", "#FFC300", "#8E44AD", "#2ECC71"];

    export  const drawerTabStyle = {
      width: '30px',
      height: '100px',
      backgroundColor: '#666',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      userSelect: 'none',
      paddingLeft:'10px',
      borderRadius: '15px 0 0 15px',
    // justifyContent: 'center',
    };
  
    // 메뉴 본체 (폭 140px, 높이 200px 전체) 
    export   const drawerMenuContentStyle = {
      width: '300px',
      height: '800px',
      border:"1px solid #ccc",
      backgroundColor: '#fff',
      padding: '6px',
      boxSizing: 'border-box',
      transition: 'right 0.3s ease',
      borderRadius: '0 0 0 15px'
    };
  

/** 컬럭 픽업 컨테이너너 */
export  const ColorPickerContainer = styled.div`
    display: flex;
    gap: 4px;
    margin-bottom: 10px;
  `;
  
export  const ColorCircle = styled.div<{ color: string; selected: boolean }>`
    width: 20px;
    height: 18px;
    border-radius: 50%;
    background-color: ${(props) => props.color};
    border: ${(props) => (props.selected ? "3px solid black" : "2px solid #ccc")};
    cursor: pointer;
    transition: 0.3s;
  `;
  
export  const PreviewBox = styled.div<{ color: string }>`
    width: 100px;
    height: 30px;
    background-color: ${(props) => props.color};
    border: 2px solid #444;
    border-radius: 10px;
    margin-top: 10px;
  `;

